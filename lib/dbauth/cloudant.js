'use strict';
var url = require('url');
var BPromise = require('bluebird');
var request = require('superagent');
var util = require('./../util');
var btoa = require("btoa");
// This is not needed with Cloudant
exports.storeKey = function() {
  return BPromise.resolve();
};

// This is not needed with Cloudant
exports.removeKeys = function() {
  return BPromise.resolve();
};

// This is not needed with Cloudant
exports.initSecurity = function() {
  return BPromise.resolve();
};

function getUrlMain(db){
  let reverseDbName = db.name.split("").reverse().join("");
  // console.log("reverseDbName1",reverseDbName);
  reverseDbName= reverseDbName.split("/");
  // console.log("reverseDbName2",reverseDbName);

  reverseDbName.shift();
  // console.log("reverseDbName3",reverseDbName);

  reverseDbName = reverseDbName.join("/");
  // console.log("reverseDbName4",reverseDbName);

  reverseDbName = reverseDbName.split("").reverse().join("");

  // console.log("reverseDbName5",reverseDbName);
  return reverseDbName;
}
function getUrl(db){
  return db.name;
}

// https://55601fbe-0b4e-41e9-a826-732365e96a90-bluemix:484a104b762e808c9fc5ec96534f4541289ffb12bc3a0eecea2a60923799b6cc@55601fbe-0b4e-41e9-a826-732365e96a90-bluemix.cloudant.com/fit-users

function getHeaders(db){
  console.log("db",db.name);
  var str = db.name.replace("https://","").split("@")[0];
  console.log("str",str);
  // unescape(encodeURIComponent(str))
  var token = btoa(str);
  console.log("token",token);
  return {
    // "Authorization" : 'Basic ' + token
  }
}



exports.authorizeKeys = function(user_id, db, keys, permissions, roles) {
  var keysObj = {};
  if(!permissions) {
    permissions = ['_reader', '_replicator'];
  }
  permissions = permissions.concat(roles || []);
  permissions.unshift('user:' + user_id);
  // If keys is a single value convert it to an Array
  keys = util.toArray(keys);
  // Check if keys is an array and convert it to an object
  if(keys instanceof Array) {
    keys.forEach(function(key) {
      keysObj[key] = permissions;
    });
  } else {
    keysObj = keys;
  }
  // Pull the current _security doc
  return getSecurityCloudant(db)
    .then(function(secDoc) {
      if(!secDoc._id) {
        secDoc._id = '_security';
      }
      if(!secDoc.cloudant) {
        secDoc.cloudant = {};
      }
      Object.keys(keysObj).forEach(function(key) {
        secDoc.cloudant[key] = keysObj[key];
      });
      return putSecurityCloudant(db, secDoc);
    });
};

exports.deauthorizeKeys = function(db, keys) {
  // cast keys to an Array
  keys = util.toArray(keys);
  return getSecurityCloudant(db)
    .then(function(secDoc) {
      var changes = false;
      if(!secDoc.cloudant) {
        return BPromise.resolve(false);
      }
      keys.forEach(function(key) {
        if(secDoc.cloudant[key]) {
          changes = true;
          delete secDoc.cloudant[key];
        }
      });
      if(changes) {
        return putSecurityCloudant(db, secDoc);
      } else {
        return BPromise.resolve(false);
      }
    });
};

exports.getAPIKey = function(db) {

  // var parsedUrl = url.parse(getUrl(db));
  // parsedUrl.pathname = '/_api/v2/api_keys';
  // var finalUrl = url.format(parsedUrl);
  let finalUrl = getUrlMain(db) + '/_api/v2/api_keys';
  // console.log("finalUrl",finalUrl);
  return BPromise.fromNode(function(callback) {
    request.post(finalUrl)
      .set(getHeaders(db))
      .end(callback);
  })
    .then(function(res) {
      var result = JSON.parse(res.text);
      if(result.key && result.password && result.ok === true) {
        return BPromise.resolve(result);
      } else {
        return BPromise.reject(result);
      }
    });
};

var getSecurityCloudant = exports.getSecurityCloudant = function (db) {
  var finalUrl = getSecurityUrl(db);
  return BPromise.fromNode(function(callback) {
    request.get(finalUrl)
      .set(getHeaders(db))
      .end(callback);
  })
    .then(function(res) {
      return BPromise.resolve(JSON.parse(res.text));
    });
};

var putSecurityCloudant = exports.putSecurityCloudant = function (db, doc) {
  var finalUrl = getSecurityUrl(db);
  return BPromise.fromNode(function(callback) {
    request.put(finalUrl)
      .set(getHeaders(db))
      .send(doc)
      .end(callback);
  })
    .then(function(res) {
      return BPromise.resolve(JSON.parse(res.text));
    });
};

function getSecurityUrl(db) {
  var parsedUrl = url.parse(getUrl(db));
  parsedUrl.pathname = parsedUrl.pathname + '/_security';
  // console.log("parsedUrl",parsedUrl);
  // console.log("url.format(parsedUrl)",url.format(parsedUrl));
  return url.format(parsedUrl);
}
