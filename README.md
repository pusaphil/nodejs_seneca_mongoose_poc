# nodejs_seneca_mongoose_poc

nodejs seneca mongoose POC

## Objective:

The objective of this repo is to demonstrate the strange behavior between Senaca and Mongoose, and understand further, with your help or anyone out there more knowledgeable than I, why the script behaves differently with and without Mongoose against `exit` signal emitted by Seneca - AFAIK.

## Out of Scope:

Validations of `.env` file, and other validations. I tried to make it simple from the original project I am working with.

## Pre-requisites:

1. You know how to use terminal/console/cmd(?) :)

2. The following must be installed in your machine.

    - git v2.17.1
    - node v8.11.3
    - npm v6.5.0
    - rabbitmq:3.7.3-management (mine is via docker)
    - mongo (mine is via docker)

3. Make sure rabbitMQ and mongo services are running.

4. Clone the [nodejs seneca mongoose POC on Github](https://github.com/pusaphil/nodejs_seneca_mongoose_poc).

5. After cloning, install npm dependencies.

## Steps to Replicate Issue:

**NOTE**: During every test, you can edit the value of `ENABLE_DB` in the `.env` file. The value of this env variable helps the script whether or not it will init the mongo connection. The **default value** is `false`.

1. After doing the pre-requisites, start the app via `node main.js`

2. Once you see `Application 'test' is up and running.`, you can now play with the rabbitMQ by turn it on and off - like literally kill the rabbitMQ process. Notice the differece on the output of the script.

3. Repeat process with different `ENABLE_DB` value in `.env` file.


## Sample output:

1. Simulating scenario **without** mongo connection initialized.

    ```
    myname@mylaptop:~/Code/etc/nodejs_seneca_mongoose_poc$ node main.js
    INFO [2019-03-21T10:38:46.122Z] (test/20093 on mylaptop): Setting message broker...
    INFO [2019-03-21T10:38:46.310Z] (test/20093 on mylaptop): Message broker ready.
    ERROR [2019-03-21T10:38:46.310Z] (test/20093 on mylaptop): ! NO MONGO CONNECTION.
    INFO [2019-03-21T10:38:46.310Z] (test/20093 on mylaptop): Application 'test' is up and running.
    INFO [2019-03-21T10:38:51.367Z] (test/20093 on mylaptop): -- Executing signal 'exit'...
    INFO [2019-03-21T10:38:51.367Z] (test/20093 on mylaptop): Closing Message broker.
    INFO [2019-03-21T10:38:51.368Z] (test/20093 on mylaptop): Message broker closed.
    ```

    In the snipet above, notice that there are not manual intervations there. The script exited after rabbitMQ is killed while this script is still running. The `exit` signal is issued by Seneca - AFAIK.
    The error `! NO MONGO CONNECTION.` is intentional. That is my identifier if the mongo DB connection is initialized.

2. Simulating scenario **with** mongo connection initialized.

    ```
    myname@mylaptop:~/Code/etc/nodejs_seneca_mongoose_poc$ node main.js
    INFO [2019-03-21T10:38:15.463Z] (test/18430 on mylaptop): Connecting to system database...
    INFO [2019-03-21T10:38:15.474Z] (test/18430 on mylaptop): Setting message broker...
    (node:18430) DeprecationWarning: current URL string parser is deprecated, and will be removed in a future version. To use the new parser, pass option { useNewUrlParser: true } to MongoClient.connect.
    INFO [2019-03-21T10:38:15.576Z] (test/18430 on mylaptop): DB conn ready.
    INFO [2019-03-21T10:38:15.664Z] (test/18430 on mylaptop): Message broker ready.
    INFO [2019-03-21T10:38:15.665Z] (test/18430 on mylaptop): Application 'test' is up and running.
    ^CINFO [2019-03-21T10:38:29.002Z] (test/18430 on mylaptop): -- Executing signal 'SIGINT'...
    INFO [2019-03-21T10:38:29.004Z] (test/18430 on mylaptop): Closing Database connection.
    INFO [2019-03-21T10:38:29.008Z] (test/18430 on mylaptop): Closing Message broker.
    INFO [2019-03-21T10:38:29.009Z] (test/18430 on mylaptop): Message broker closed.
    INFO [2019-03-21T10:38:29.016Z] (test/18430 on mylaptop): Database connection closed.
    INFO [2019-03-21T10:38:29.022Z] (test/18430 on mylaptop): Graceful exit done. Terminating process...
    INFO [2019-03-21T10:38:29.022Z] (test/18430 on mylaptop): -- Executing signal 'exit'...
    INFO [2019-03-21T10:38:29.023Z] (test/18430 on mylaptop): Closing Database connection.
    INFO [2019-03-21T10:38:29.023Z] (test/18430 on mylaptop): Database connection closed.
    INFO [2019-03-21T10:38:29.023Z] (test/18430 on mylaptop): Closing Message broker.
    INFO [2019-03-21T10:38:29.024Z] (test/18430 on mylaptop): Message broker closed.
    ```
    In the snipet above, notice the `^C` because I already intervine with the process. The rabbitMQ is already kill few seconds early but the script is still running. But when the `^C` process take place, the script recognized the command as a `SIGINT` signal and graceful exit takes place. The `exit` signal is from the `gracefulExit` Promise block. The `exit` signal from the Seneca was never queued in the event loop. Why?

