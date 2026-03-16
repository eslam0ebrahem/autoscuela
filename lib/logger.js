import pino from 'pino'

const isDevelopment = process.env.NODE_ENV === 'development'

const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          singleLine: false,
          translateTime: 'SYS:standard',
        },
      }
    : undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
})

export default logger
