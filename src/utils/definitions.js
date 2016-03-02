/* @flow */

import {
  GraphQLObjectType,
  GraphQLInterfaceType
} from 'graphql'

export type ClientTypes = {
  [key: string]: {
    objectType: GraphQLObjectType,
    mutationInputArguments: GraphQLObjectType,
    edgeType: GraphQLObjectType,
    connectionType: GraphQLObjectType,
    clientSchema: ClientSchema
  }
}

export type AllTypes = {
  clientTypes: ClientTypes,
  NodeInterfaceType: GraphQLInterfaceType,
  viewerType: GraphQLObjectType
}

export type GraphQLFields = {
  [key: string]: GraphQLObjectType
}

export type ClientSchema = {
  modelName: string,
  fields: Array<ClientSchemaField>
}

export type ClientSchemaField = {
  fieldName: string,
  typeName: string,
  nullable: boolean,
  list: boolean
}
