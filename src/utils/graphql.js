import deepcopy from 'deepcopy'

import {
  fromGlobalId
} from 'graphql-relay'

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

export function convertInputFieldsToInternalIds (args, clientSchema) {
  const fieldsToConvert = getRelationFields(args, clientSchema)
  fieldsToConvert.forEach((field) => {
    args[`${field.fieldName}Id`] = fromGlobalId(args[`${field.fieldName}Id`]).id
  })

  if (args.id) {
    args.id = fromGlobalId(args.id).id
  }

  return args
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

export function externalIdFromQueryInfo (info) {
  // relies on the fact that the `node` query has 1 argument that is the external id
  const idArgument = info.operation.selectionSet.selections[0].arguments[0]
  const variables = info.variableValues
  return idArgument.value.kind === 'Variable'
    ? variables[idArgument.value.name.value]
    : idArgument.value.value
}
