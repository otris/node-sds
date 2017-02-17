# node-sds
A Node.js module to communicate with JANUS-generated applications. Written in
TypeScript.

## Examples

## Install
Easy. In your project, run
```bash
$ npm install --save git+https://git@github.com/otris/node-sds.git
```
Note that there is no npm package. You should always just use the latest
development version (HEAD in master branch).

## Dependencies
Except [mocha](https://mochajs.org/) for testing and
[promised-timeout](https://github.com/xpepermint/promised-timeout) no extra
dependencies are required.

## About SDS
SDS (or SDS2) is a synchronous binary application-layer protocol on top of TCP
that "real" JANUS clients use to speak to JANUS servers.

It feels a little bit like RPC in the sense that you can execute operations on
a remote server. Those operations can have an arbitrary number of parameters
and usually return something back.

The protocol is quite old, cumbersome, and it is easy to make mistakes.
Therefore you probably should just not use it at all. However, it gives you
direct access to any JANUS-based server without the need to install additional
SOAP or web service components.

## Current status
This module does not support all SDS operations and calls. Only the pieces we
needed to get along. There is probably still plenty missing. But it should not
be terribly complicated to add support for those pieces.

## Development
If you want to hack on this module you could start with following recipe:

```bash
$ git clone https://github.com/otris/node-sds.git  # Clone the repo
$ cd node-sds  #  Change into the source directory
$ npm install  # Install all dependencies
$ npm run --silent test  # Execute all tests
```
Happy hacking!

<!-- vim: et sw=4 ts=4:
-->
