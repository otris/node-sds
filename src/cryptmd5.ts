/**
 * Implementation based on source from freebsd module crypt-md5.c from Poul-Henning Kamp.
 * Found on https://github.com/freebsd/freebsd/blob/master/lib/libcrypt/crypt-md5.c 
 * 
 * Other sources are found on 
 * https://github.com/joyent/syslinux/blob/master/com32/libutil/crypt-md5.c 
 * and
 * https://pythonhosted.org/passlib/lib/passlib.hash.md5_crypt.html
 * 
 * latest recall of these webpages : 22.02.2017 
 */

'use strict';
 var crypto = require('crypto');

function _crypt_to64(s : string, v : number, n : number) : string
{
    let ret_str : string = '';
    let itoa64 : string = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    while (--n >= 0) 
    {
        ret_str += itoa64.charAt(v & 0x3f);
        v >>= 6;
    }
    return ret_str;
}

/**
 * A hashed string.
 *
 * The value property always looks like follows.
 *
 *     $id$salt$encrypted
 *
 * Whereas id is always 1, salt is the salt used during encryption and can be empty, and encrypted is the actual
 * computed secret.
 */
export class Hash {
    constructor(public value: string) { }
}

/**
 * Mimics POSIX crypt(3) with MD5 instead of DES.
 * @param {string} key A user's typed secret.
 * @param {string} salt The salt used to perturb the algorithm. Can be empty.
 */
export function crypt_md5(key: string, salt: string): Hash {
    
    let MD5_SIZE : number = 16;
    // The context for hashing.
    var ctx, ctx1 : any;
    // The magic (or id) that identify the process
    let magic : string = '$1$';
    
    // Init the first context ctx with the required hash-algorithm.
    ctx = crypto.createHash('md5');
    // Update ctx with the key, the magic and the salt.
    ctx.update(key);
    ctx.update(magic);
    ctx.update(salt);

    // Init the second context ctx1 with the required hash-algorithm.
    ctx1 = crypto.createHash('md5');
    // Update ctx1 wit the key, the salt and the key again.
    ctx1.update(key);
    ctx1.update(salt);
    ctx1.update(key);
    // Save the result of ctx1 in final.
    let final  = ctx1.digest('binary');

    // For every block of MD5_SIZE that fits in the length of the key, do...
    for (let pl : number = key.length; pl > 0; pl -= MD5_SIZE)
    {
        // ... update ctx with the result of ctx1, with the max length of MD5_SIZE.
        ctx.update(final.substr(0, pl > MD5_SIZE ? MD5_SIZE : pl), 'binary');
    }           

	// For every Bit of the length of the key, decide wether...
    for (let i : number = key.length; i; i >>= 1)
    {
        // ...if the LSB is not set, update ctx with 0.
        if (i & 1)  
            ctx.update('\0', 'binary');
        // ...if the LSB is 1, update ctx with the first char of the key.
        else
            ctx.update(key.substr(0, 1));
    }
    // Save the result of ctx1 in final.   
    final = ctx.digest('binary');
    
    // Delay the final computation (?)
    for (let i : number = 0; i < 1000; i++)
    {
        ctx1 = crypto.createHash('md5');

        if (i & 1)
            ctx1.update(key);
        else
            ctx1.update(final, 'binary');
        
        if (i % 3)
            ctx1.update(salt);
        
        if (i % 7)
            ctx1.update(key);

        if (i & 1)
            ctx1.update(final, 'binary');
        else
            ctx1.update(key);
        
        final = ctx1.digest('binary');
    }
  
   // Variables for the last computation.
   let l : number = 0;
   let p : string = '';

   // Transpose and calc the hash/base-64 val.
   l = final.charCodeAt(0) << 16 | final.charCodeAt(6) << 8 | final.charCodeAt(12);
   p += _crypt_to64(p, l, 4);
   l = final.charCodeAt(1) << 16 | final.charCodeAt(7) << 8 | final.charCodeAt(13);
   p += _crypt_to64(p, l, 4);
   l = final.charCodeAt(2) << 16 | final.charCodeAt(8) << 8 | final.charCodeAt(14);
   p += _crypt_to64(p, l, 4);
   l = final.charCodeAt(3) << 16 | final.charCodeAt(9) << 8 | final.charCodeAt(15);
   p += _crypt_to64(p, l, 4);
   l = final.charCodeAt(4) << 16 | final.charCodeAt(10) << 8 | final.charCodeAt(5);
   p += _crypt_to64(p, l, 4); 
   l = final.charCodeAt(11);
   p += _crypt_to64(p, l, 4);

   // Cut the remaining padding off.
   p = p.substr(0, p.length-2);

   // The variable p now stores the real hash.
   const result = magic + salt + '$' + p;
   return new Hash(result);
}
