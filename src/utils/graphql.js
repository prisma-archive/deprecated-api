/* @flow */

import deepcopy from 'deepcopy'

import type {
  ClientSchema,
  ClientSchemaField
} from './definitions.js'

import {
  fromGlobalId
} from 'graphql-relay'

export function isScalar (typeIdentifier: string): boolean {
  const scalarTypes = ['String', 'Int', 'Float', 'Boolean', 'GraphQLID', 'Password', 'Enum']
  return scalarTypes.filter((x) => x === typeIdentifier).length > 0
}

export function isReservedType (typeIdentifier: string): boolean {
  const reservedTypeIdentifiers = ['User']
  return reservedTypeIdentifiers.filter((x) => x === typeIdentifier).length > 0
}

export function getFieldNameFromModelName (modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1)
}

export function getFieldsForBackRelations (
  args: { [key: string]: any }, clientSchema: ClientSchema
  ): [ClientSchemaField] {
  return clientSchema.fields.filter((field) => field.backRelationName && args[`${field.fieldName}Id`])
}

export function getRelationFields (args: { [key: string]: any }, clientSchema: ClientSchema): [ClientSchemaField] {
  return clientSchema.fields.filter((field) => !isScalar(field.typeIdentifier) && args[`${field.fieldName}Id`])
}

export function convertInputFieldsToInternalIds (
  args: { [key: string]: any }, clientSchema: ClientSchema
  ): { [key: string]: any } {
  const fieldsToConvert = getRelationFields(args, clientSchema)
  fieldsToConvert.forEach((field) => {
    args[`${field.fieldName}Id`] = fromGlobalId(args[`${field.fieldName}Id`]).id
  })

  if (args.id) {
    args.id = fromGlobalId(args.id).id
  }

  return args
}

export function patchConnectedNodesOnIdFields (
  node: Object, connectedNodes: [Object], clientSchema: ClientSchema
  ): Object {
  const nodeClone = deepcopy(node)
  getRelationFields(node, clientSchema).forEach((field) => {
    const connectedNode = connectedNodes.filter((x) => x.id === node[`${field.fieldName}Id`])[0]
    if (connectedNode) {
      nodeClone[field.fieldName] = connectedNode
    }
  })

  return nodeClone
}

export function externalIdFromQueryInfo (info: Object): string {
  // relies on the fact that the `node` query has 1 argument that is the external id
  const idArgument = info.operation.selectionSet.selections[0].arguments[0]
  const variables = info.variableValues
  return idArgument.value.kind === 'Variable'
    ? variables[idArgument.value.name.value]
    : idArgument.value.value
}
