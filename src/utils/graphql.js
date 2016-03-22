export function isScalar (typeIdentifier) {
  const scalarTypes = ['String', 'Int', 'Float', 'Boolean', 'GraphQLID', 'Enum']
  return scalarTypes.filter((x) => x === typeIdentifier).length > 0
}
