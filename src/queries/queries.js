/* @flow */

import {
  GraphQLNonNull,
  GraphQLID
} from 'graphql'

import type {
  AllTypes,
  GraphQLFields,
  SchemaType
} from '../utils/definitions.js'

import {
  fromGlobalId
} from 'graphql-relay'

import {
  mergeObjects
} from '../utils/object.js'

export function createQueryEndpoints (
  input: AllTypes,
  schemaType: SchemaType
): GraphQLFields {
  var queryFields = {}
  const clientTypes = input.clientTypes
  const viewerType = input.viewerType
  const viewerFields = input.viewerFields

  for (const modelName in clientTypes) {
    // query single model by id
    queryFields[modelName] = {
      type: clientTypes[modelName].objectType,
      args: clientTypes[modelName].uniqueQueryInputArguments,
      resolve: (_, args, { operation, rootValue: { currentUser, backend } }) => {
        return backend.allNodesByType(modelName, {filter: args}, clientTypes[modelName].clientSchema, currentUser, operation)
        .then(({array}) => array[0])
      }
    }
  }

  if (schemaType === 'RELAY') {
    queryFields['viewer'] = {
      type: viewerType,
      resolve: (_, args, { rootValue: { backend } }) => (
        backend.user()
      )
    }
  }
  if (schemaType === 'SIMPLE') {
    queryFields = mergeObjects(queryFields, viewerFields)
  }

  queryFields['node'] = {
    name: 'node',
    description: 'Fetches an object given its ID',
    type: input.NodeInterfaceType,
    args: {
      id: {
        type: new GraphQLNonNull(GraphQLID),
        description: 'The ID of an object'
      }
    },
    resolve: (obj, {id}, { operation, rootValue: { currentUser, backend } }) => {
      const {id: internalId, type} = fromGlobalId(id)

      return backend.node(type, internalId, clientTypes[type].clientSchema, currentUser, operation)
      .then((node) => {
        return node
      })
    }
  }

  return queryFields
}
