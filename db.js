import { MongoClient } from 'mongodb';

const uri = 'mongodb://localhost:27017/myAngularProject';
const client = new MongoClient(uri);

let dbInstance = null;

export async function getDb() {
  if (!dbInstance) {
    await client.connect();
    dbInstance = client.db();
    console.log('Connected to MongoDB');
  }
  return dbInstance;
}
