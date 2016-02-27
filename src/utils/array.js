/* @flow */

export function mapArrayToObject<E, K, V> (
  array: Array<E>,
  keyFunction: (e: E) => K,
  mapFunction: (e: E) => V,
  initialObject: { [key: K]: V } = {}
): { [key: K]: V } {
  return array.reduce((obj, val) => {
    obj[keyFunction(val)] = mapFunction(val)
    return obj
  }, initialObject)
}
