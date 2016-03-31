/* @flow */

export function mergeObjects (obj1: Object, obj2: Object): Object {
  var obj3 = {}
  for (const attrname in obj1) { obj3[attrname] = obj1[attrname] }
  for (const attrname in obj2) { obj3[attrname] = obj2[attrname] }

  return obj3
}
