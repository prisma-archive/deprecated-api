/* @flow */

import type {
  ClientSchema,
  ClientSchemaField
} from './definitions.js'

import {
  fromGlobalId,
  toGlobalId
} from 'graphql-relay'

import {isValidDateTime} from '../types/GraphQLDateTime'

import deepcopy from 'deepcopy'

export function isValidName (name: string): boolean {
  return /^[_a-zA-Z][_a-zA-Z0-9]*$/.test(name)
}

export function isValidProjectName (name: string): boolean {
  return /^[_a-zA-Z][_a-zA-Z0-9\s-]*$/.test(name)
}

export function isScalar (typeIdentifier: string): boolean {
  const scalarTypes = ['String', 'Int', 'Float', 'Boolean', 'GraphQLID', 'Password', 'Enum', 'DateTime']
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
  originalArgs: { [key: string]: any }, clientSchema: ClientSchema, alsoConvert: [string] = []
  ): { [key: string]: any } {
  const args = deepcopy(originalArgs)
  const fieldsToConvert = getRelationFields(args, clientSchema)
  fieldsToConvert.forEach((field) => {
    if (args[`${field.fieldName}Id`]) {
      args[`${field.fieldName}Id`] = fromGlobalId(args[`${field.fieldName}Id`]).id
    }
  })

  if (args.id) {
    args.id = fromGlobalId(args.id).id
  }

  alsoConvert.forEach((fieldName) => {
    args[fieldName] = fromGlobalId(args[fieldName]).id
  })

  return args
}

export function convertIdToExternal (typeIdentifier: string, node: Object): Object {
  const nodeWithExternalId = deepcopy(node)
  nodeWithExternalId.id = toGlobalId(typeIdentifier, nodeWithExternalId.id)

  return nodeWithExternalId
}

export function patchConnectedNodesOnIdFields (
  node: Object, connectedNodes: [Object], clientSchema: ClientSchema
  ): Object {
  const nodeClone = deepcopy(node)
  getRelationFields(node, clientSchema).forEach((field) => {
    const connectedNode = connectedNodes.filter((x) => x.id === node[`${field.fieldName}Id`])[0]
    if (connectedNode) {
      const nodeWithConvertedId = convertIdToExternal(field.typeIdentifier, connectedNode)
      nodeClone[field.fieldName] = nodeWithConvertedId
      nodeClone[`${field.fieldName}Id`] = nodeWithConvertedId.id
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

export function parseValue (value: string, typeIdentifier: string): any {
  return {
    String: () => value,
    Boolean: () =>
    (value === 'true' || value === 'True') ? true : (value === 'false' || value === 'False') ? false : null,
    Int: () => isNaN(parseInt(value)) ? null : parseInt(value),
    Float: () => isNaN(parseFloat(value)) ? null : parseFloat(value),
    GraphQLID: () => value,
    Password: () => value,
    Enum: () => isValidName(value) ? value : null,
    DateTime: () => isValidDateTime(value) ? value : null
  }[typeIdentifier]()
}

export function isValidValueForType (value: string, typeIdentifier: string): boolean {
  const parsedValue = parseValue(value, typeIdentifier)
  return parsedValue !== null && parsedValue !== undefined
}
