/* @flow */

import {
  GraphQLObjectType,
  GraphQLInterfaceType
} from 'graphql'

export type ClientTypes = {
  [key: string]: {
    objectType: GraphQLObjectType,
    createMutationInputArguments: GraphQLObjectType,
    updateMutationInputArguments: GraphQLObjectType,
    queryFilterInputArguments: GraphQLObjectType,
    uniqueQueryInputArguments: GraphQLObjectType,
    edgeType: GraphQLObjectType,
    connectionType: GraphQLObjectType,
    clientSchema: ClientSchema
  }
}

export type AllTypes = {
  clientTypes: ClientTypes,
  NodeInterfaceType: GraphQLInterfaceType,
  viewerType: GraphQLObjectType,
  viewerFields: GraphQLFields
}

export type GraphQLFields = {
  [key: string]: GraphQLObjectType
}

export type ClientSchema = {
  modelName: string,
  fields: Array<ClientSchemaField>
}

export type Relation = {
  id: string,
  modelA: string,
  modelB: string
}

export type permission = {
  id: string,
  userType: string,
  userPath: ?string,
  userRole: ?string,
  allowRead: boolean,
  allowCreate: boolean,
  allowUpdate: boolean,
  allowDelete: boolean
}

export type ClientSchemaField = {
  fieldName: string,
  typeIdentifier: string,
  backRelationName: ?string,
  relationId: ?string,
  relation: ?Relation,
  relationSide: ?string,
  enumValues: [string],
  isRequired: boolean,
  isList: boolean,
  isUnique: boolean,
  isSystem: boolean,
  defaultValue: ?string,
  permissions: [permission],
  description: ?string
}

export type SchemaType = 'SIMPLE' | 'RELAY';
