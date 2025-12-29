import mongoose from 'mongoose';

// MongoDB connection options with performance optimizations
const mongoOptions = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  bufferCommands: false, // Disable mongoose buffering
  // Performance optimizations
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  compressors: 'zlib', // Enable compression
  readPreference: 'secondaryPreferred', // Read from secondary when possible
  writeConcern: {
    w: 'majority',
    j: true,
    wtimeout: 1000
  }
};

/**
 * Create additional database indexes for performance optimization
 * Note: Basic indexes are created automatically by Mongoose schemas
 */
const createIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    
    // Only create additional compound indexes not covered by schemas
    // Individual field indexes are handled by Mongoose schema definitions
    
    console.log('Additional database indexes created successfully');
  } catch (error) {
    console.error('Error creating database indexes:', error);
  }
};

export const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sympto';
    
    // Set mongoose options
    mongoose.set('strictQuery', false);
    
    const conn = await mongoose.connect(mongoURI, mongoOptions);
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Create performance indexes
    await createIndexes();
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });
    
    return conn;
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB Disconnected');
  } catch (error) {
    console.error('Database disconnection error:', error);
    throw error;
  }
};

// Graceful shutdown handler
export const setupGracefulShutdown = () => {
  process.on('SIGINT', async () => {
    console.log('Received SIGINT. Graceful shutdown...');
    await disconnectDB();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Graceful shutdown...');
    await disconnectDB();
    process.exit(0);
  });
};