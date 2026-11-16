import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { AdminUser, StoreSettings, User } from './models.ts';

type MemoryServerInstance = {
  getUri: (dbName?: string) => string;
  stop: () => Promise<boolean>;
};

const globalForMongo = globalThis as typeof globalThis & {
  __shopAdminMongoPromise?: Promise<typeof mongoose> | null;
  __shopAdminCoreInitPromise?: Promise<void> | null;
  __shopAdminMemoryServer?: MemoryServerInstance | null;
  __shopAdminConnectionMode?: 'external' | 'embedded';
};

export function getMongoStatus() {
  return {
    connected: mongoose.connection.readyState === 1,
    mode: globalForMongo.__shopAdminConnectionMode || (process.env.MONGODB_URI?.trim() ? 'external' : 'embedded'),
    dbName: mongoose.connection.name || 'ecom_store',
  };
}

export async function connectToMongoDB() {
  if (mongoose.connection.readyState === 1) {
    if (!globalForMongo.__shopAdminCoreInitPromise) {
      globalForMongo.__shopAdminCoreInitPromise = ensureCoreSystemConfig().catch((err) => {
        globalForMongo.__shopAdminCoreInitPromise = null;
        throw err;
      });
    }
    await globalForMongo.__shopAdminCoreInitPromise;
    return;
  }

  if (!globalForMongo.__shopAdminMongoPromise) {
    globalForMongo.__shopAdminMongoPromise = (async () => {
      let uri = process.env.MONGODB_URI?.trim();

      if (uri) {
        globalForMongo.__shopAdminConnectionMode = 'external';
      } else {
        if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
          throw new Error(
            'MONGODB_URI environment variable is missing. Please add MONGODB_URI in your deployment environment variables.'
          );
        }
        globalForMongo.__shopAdminConnectionMode = 'embedded';
        const dbPath = path.resolve(process.cwd(), '.data', 'mongodb');
        fs.mkdirSync(dbPath, { recursive: true });

        // Clean stale lock file if container restarted unexpectedly
        const lockPath = path.join(dbPath, 'mongod.lock');
        if (fs.existsSync(lockPath)) {
          try {
            const lockContent = fs.readFileSync(lockPath, 'utf8').trim();
            if (!lockContent) {
              fs.unlinkSync(lockPath);
            }
          } catch {
            // Ignore lock cleanup failure
          }
        }

        const memoryPkg = 'mongodb-memory-server';
        const { MongoMemoryServer } = (await import(memoryPkg)) as {
          MongoMemoryServer: {
            create: (opts: unknown) => Promise<MemoryServerInstance>;
          };
        };
        const mem = await MongoMemoryServer.create({
          instance: {
            dbPath,
            storageEngine: 'wiredTiger',
            dbName: 'ecom_store',
          },
        });
        globalForMongo.__shopAdminMemoryServer = mem;
        uri = mem.getUri('ecom_store');
      }

      const maxPoolSize = Number(
        process.env.MONGODB_MAX_POOL_SIZE || (process.env.VERCEL ? 15 : 25)
      );

      return mongoose.connect(uri, {
        dbName: 'ecom_store',
        maxPoolSize,
        minPoolSize: process.env.VERCEL ? 1 : 2,
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
        maxIdleTimeMS: 30000,
      });
    })().catch((err) => {
      globalForMongo.__shopAdminMongoPromise = null;
      throw err;
    });
  }

  await globalForMongo.__shopAdminMongoPromise;

  if (!globalForMongo.__shopAdminCoreInitPromise) {
    globalForMongo.__shopAdminCoreInitPromise = ensureCoreSystemConfig().catch((err) => {
      globalForMongo.__shopAdminCoreInitPromise = null;
      throw err;
    });
  }
  await globalForMongo.__shopAdminCoreInitPromise;
}

function mapAdminRoleToUserRole(role?: string): 'super_admin' | 'admin' | 'manager' {
  if (role === 'Super Admin') return 'super_admin';
  if (role === 'Manager') return 'manager';
  return 'admin';
}

async function ensureCoreSystemConfig() {
  // Initialize singleton store settings document if absent (no mock orders/products/users)
  const existingSettings = await StoreSettings.findOne({ singletonKey: 'default' });
  if (!existingSettings) {
    await StoreSettings.create({
      singletonKey: 'default',
      shipping: {
        enableShipping: true,
        freeShipping: true,
        flatRateShipping: false,
        shippingCharge: 40,
        freeShippingThreshold: 999,
        processingTime: '1 Business Day',
        showEstimatedDelivery: true,
        allowDifferentShippingAddress: true,
        methods: [
          {
            name: 'Standard Delivery',
            description: 'Regular delivery service',
            deliveryTime: '3-5 Business Days',
            charge: 40,
            status: 'Active',
          },
        ],
      },
      tax: {
        enableGst: true,
        gstin: '',
        pricingMode: 'inclusive',
        defaultTaxRate: 18,
        businessType: 'GST Registered Business',
        legalBusinessName: '',
        placeOfSupplyState: 'Rajasthan',
        stateCode: '08',
        rates: [],
      },
    });
  }

  // Ensure primary admin account exists so Security & Users & Permissions work immediately
  const adminCount = await AdminUser.countDocuments();
  if (adminCount === 0) {
    const defaultPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Admin@123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    await AdminUser.create({
      name: 'Sikandar Khan',
      email: 'sikandaritguy@gmail.com',
      passwordHash,
      role: 'Super Admin',
      user_role: 'super_admin',
      status: 'Active',
      lastLogin: new Date(),
    });
  }

  // Ensure every admin user has user_role set and is synced into the users collection
  const admins = await AdminUser.find();
  for (const admin of admins) {
    const mappedRole = mapAdminRoleToUserRole(admin.role);
    if (admin.user_role !== mappedRole) {
      admin.user_role = mappedRole;
      await admin.save();
    }
    await User.findOneAndUpdate(
      { email: admin.email.toLowerCase() },
      {
        $set: {
          name: admin.name,
          email: admin.email.toLowerCase(),
          user_role: mappedRole,
          status: admin.status === 'Inactive' ? 'Blocked' : 'Active',
          lastLogin: admin.lastLogin || new Date(),
        },
        $setOnInsert: {
          phone: '',
          activities: [
            {
              type: 'profile',
              title: 'Admin Account Initialized',
              description: `Registered with user_role: ${mappedRole}`,
              createdAt: new Date(),
            },
          ],
        },
      },
      { upsert: true, new: true }
    );
  }

  // Backfill any existing user documents missing user_role
  await User.updateMany(
    { $or: [{ user_role: { $exists: false } }, { user_role: null }, { user_role: '' }] },
    { $set: { user_role: 'customer' } }
  );
}

export async function disconnectMongoDB() {
  globalForMongo.__shopAdminMongoPromise = null;
  globalForMongo.__shopAdminCoreInitPromise = null;
  await mongoose.disconnect();
  if (globalForMongo.__shopAdminMemoryServer) {
    await globalForMongo.__shopAdminMemoryServer.stop();
    globalForMongo.__shopAdminMemoryServer = null;
  }
}
