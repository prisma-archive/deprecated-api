import {
  GraphQLObjectType,
  GraphQLBoolean
} from 'graphql'

export type ClientSchema = {
  name: string,
  fields: Array<ClientSchemaField>
}

export type ClientSchemaField = {
  name: string,
  typeName: string,
  nullable: boolean,
  list: boolean
}
