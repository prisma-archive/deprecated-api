/* @flow */

import {
  GraphQLObjectType
} from 'graphql'

export type ClientTypes = {
  [key: string]: {
    objectType: GraphQLObjectType,
    edgeType: GraphQLObjectType,
    connectionType: GraphQLObjectType,
    clientSchema: ClientSchema
  }
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
