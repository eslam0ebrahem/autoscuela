import '@testing-library/jest-dom'

// Mock Next.js modules
global.fetch = vi.fn()

// Mock environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.MONGODB_URI = 'mongodb://test:test@localhost:27017/vialia-test'
process.env.NODE_ENV = 'test'
