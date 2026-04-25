import mongoose from 'mongoose'

/**
 * Execute a function within a transaction if supported by the MongoDB deployment.
 * Automatically falls back to non-transactional execution on standalone instances.
 * 
 * @param {Function} fn - Async function to execute. Receives (session) as argument.
 * @returns {Promise<any>} Result of the function.
 */
export async function withTransaction(fn) {
  const session = await mongoose.startSession()
  
  // Check if we are on a replica set or mongos (transactions require one of these)
  // Standalone instances throw "Transaction numbers are only allowed on a replica set member or mongos"
  const isReplicaSet = mongoose.connection.getClient().topology?.description?.type === 'ReplicaSetWithPrimary' || 
                       mongoose.connection.getClient().topology?.type === 'ReplicaSetWithPrimary' ||
                       mongoose.connection.getClient().topology?.description?.type === 'Sharded'

  // More robust check: try to start the transaction and catch the specific "standalone" error early if possible,
  // or just use a simple flag if we know the environment.
  // For now, we'll try a more defensive approach: try withTransaction, if it fails with code 20 (IllegalOperation), 
  // fallback to non-transactional.
  
  try {
    let result
    await session.withTransaction(async () => {
      result = await fn(session)
    })
    return result
  } catch (err) {
    // Error code 20 is "IllegalOperation" which includes "Transaction numbers are only allowed on a replica set member or mongos"
    if (err.code === 20 || err.message.includes('Transaction numbers are only allowed')) {
      console.warn('[db-utils] Transactions not supported by this MongoDB deployment. Falling back to non-transactional execution.')
      return await fn(null)
    }
    throw err
  } finally {
    await session.endSession()
  }
}
