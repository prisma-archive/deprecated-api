/* @flow */

export function mapToObject<E, K, V> (
  array: Array<E>,
  keyFn: (e: E) => K,
  mapFn: (e: E) => V
): { [key: K]: V } {
  const obj: { [key: K]: V } = {}
  return array.reduce((obj, val) => {
    obj[keyFn(val)] = mapFn(val)
    return obj
  }, obj)
}
