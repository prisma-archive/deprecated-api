import deepcopy from 'deepcopy'

export function isScalar (typeIdentifier) {
  const scalarTypes = ['String', 'Int', 'Float', 'Boolean', 'GraphQLID', 'Enum']
  return scalarTypes.filter((x) => x === typeIdentifier).length > 0
}

export function getFieldNameFromModelName (modelName) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1)
}

export function getFieldsForBackRelations (args, clientSchema) {
  return clientSchema.fields.filter((field) => field.backRelationName && args[`${field.fieldName}Id`])
}

export function getRelationFields (args, clientSchema) {
  return clientSchema.fields.filter((field) => !isScalar(field.typeIdentifier) && args[`${field.fieldName}Id`])
}

export function patchConnectedNodesOnIdFields (node, connectedNodes, clientSchema) {
  const nodeClone = deepcopy(node)
  getRelationFields(node, clientSchema).forEach((field) => {
    const connectedNode = connectedNodes.filter((x) => x.id === node[`${field.fieldName}Id`])[0]
    if (connectedNode) {
      nodeClone[field.fieldName] = connectedNode
    }
  })

  return nodeClone
}
