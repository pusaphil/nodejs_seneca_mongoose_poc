'use strict'
/*
  Note:
    - I intentionally put everything in one file
    - To experiment on the DB conn, edit the ENABLE_DB in the .env file
*/
require('dotenv').config()

global.Promise = require('bluebird')

const _ = require('lodash')
const pino = require('pino')
const seneca = require('seneca')
const mongoose = require('mongoose')

let pretty = pino.pretty({
  levelFirst: true,
  forceColor: true
})

pretty.pipe(process.stdout)

let logger = pino({
  name: process.env.RESOURCE_NAME,
  safe: true
}, pretty)


class MessageBroker {
  constructor (logger) {
    this.logger = logger
  }

  bootstrap () {
    return new Promise((resolve, reject) => {
      this.logger.info('Setting message broker...')

      let serviceName = `svc:${process.env.RESOURCE_NAME},cmd:addTimestamp`
      let serviceBus = seneca({debug: {undead: true}})
      serviceBus.test()
      // serviceBus.fixedargs.fatal$ = true
      serviceBus.use('seneca-amqp-transport', { amqp: { listener: { queues: { options: { durable: false } } } } })
      serviceBus.error((err) => {
        console.log('!! Error on Message Broker', err)
        reject(err)
      })

      serviceBus.add(serviceName, (args, done) => {
        return new Promise((resolve, reject) => {
          console.log(serviceName)
          args.created_at = new Date()
          resolve(done(null, args))
        }).catch(err => done(err, null))
      })

      serviceBus.listen({
        type: 'amqp',
        url: process.env.RABBITMQ_URL,
        pin: [
          serviceName,
        ]
      })

      serviceBus.ready(() => {
        this.logger.info('Message broker ready.')
        this.serviceBus = serviceBus

        resolve(serviceBus)
      })
    })
  }

  close () {
    this.logger.info('Closing Message broker.')

    return new Promise((resolve) => {
      if (typeof this.serviceBus !== 'undefined') {
        this.serviceBus.close()
        this.logger.info('Message broker closed.')
      }

      resolve()
    })
  }
}

class Db {
  constructor (logger) {
    this.logger = logger
  }

  bootstrap () {
    return new Promise((resolve) => {
      // DB init bypass
      if (process.env.ENABLE_DB === 'true') {
        this.logger.info('Connecting to system database...')

        mongoose.connect(process.env.MONGO_URL, {})
        .then((conn) => {
          this.logger.info('DB conn ready.')
          resolve(conn)
        })
        .catch((err) => {
          this.logger.error('Error on start: ' + err.stack);
          throw err
        })
      } else {
        resolve()
      }
    })
  }

  close () {


    return new Promise((resolve, reject) => {
      // DB init bypass
      if (process.env.ENABLE_DB === 'true') {
        this.logger.info('Closing Database connection.')
        mongoose.disconnect((err) => {
          if (!_.isNil(err)) {
            reject(err)
          } else {
            this.logger.info('Database connection closed.')

            resolve()
          }
        })
      } else {
        resolve()
      }
    })
  }
}

let env = {
  db: new Db(logger),
  messageBroker: new MessageBroker(logger)
}

let gracefulExit = function () {
  return Promise.all([
    env.db.close(),
    env.messageBroker.close()
  ]).timeout(1000)
}

// Listen for ff Signal Events for graceful shutdown
// 'exit' signal mostly emit by Seneca
_.forEach(['exit', 'SIGHUP', 'SIGINT', 'SIGTERM'], (signal) => {
  process.once(signal, () => {
    logger.info(`-- Executing signal '${signal}'...`)

    gracefulExit().then(() => {
      logger.info('Graceful exit done. Terminating process...')
      process.exit(1)
    }).catch(Promise.TimeoutError, () => {
      logger.warn('Graceful exit timeout. Force terminating process...')
      process.exit(1)
    }).catch((err) => {
      logger.error(err)

      setTimeout(() => {
        process.exit(1)
      }, 1000)
    })
  })
})

module.exports = Promise.props({
  logger: logger,
  db: env.db.bootstrap(),
  messageBroker: env.messageBroker.bootstrap()
}).then(environment => {
  if (typeof environment.db === 'undefined') {
    logger.error('! NO MONGO CONNECTION.')
  }
  logger.info(`Application '${process.env.RESOURCE_NAME}' is up and running.`)
}).catch(err => {
  if (process.env.NODE_ENV !== 'production') {
    logger.error(err)
  } else {
    throw err
  }
})
