/* @flow */

import type {
  ClientTypes,
  ClientSchemaField,
  SchemaType
} from '../utils/definitions.js'

import {
  GraphQLNonNull,
  GraphQLID,
  GraphQLObjectType
} from 'graphql'

import {
  mutationWithClientMutationId
} from 'graphql-relay'

import { getFieldNameFromModelName, convertInputFieldsToInternalIds } from '../utils/graphql.js'

import simpleMutation from './simpleMutation.js'

export default function (
  viewerType: GraphQLObjectType,
  clientTypes: ClientTypes,
  modelName: string,
  connectionField: ClientSchemaField,
  schemaType: SchemaType
  ): GraphQLObjectType {
  const config = {
    name: `Remove${connectionField.typeIdentifier}From${connectionField.fieldName}ConnectionOn${modelName}`,
    outputFields: {
      [getFieldNameFromModelName(modelName)]: {
        type: clientTypes[modelName].objectType
      },
      viewer: {
        type: viewerType,
        resolve: (_, args, { rootValue: { backend } }) => (
          backend.user()
        )
      }
    },
    inputFields: {
      fromId: {
        type: new GraphQLNonNull(GraphQLID)
      },
      toId: {
        type: new GraphQLNonNull(GraphQLID)
      }
    },
    mutateAndGetPayload: (args, { rootValue: { currentUser, backend, webhooksProcessor } }) => {
      args = convertInputFieldsToInternalIds(args, clientTypes[modelName].clientSchema, ['fromId', 'toId'])

      const fromType = modelName
      const fromId = args.fromId
      const toType = connectionField.typeIdentifier
      const toId = args.toId

      const relation = connectionField.relation

      const aId = connectionField.relationSide === 'A' ? fromId : toId
      const bId = connectionField.relationSide === 'B' ? fromId : toId

      return backend.removeRelation(relation.id, aId, bId, fromType, fromId, toType, toId)
      .then(({fromNode, toNode}) => {
        webhooksProcessor.nodeAddedToConnection(
          toNode,
          connectionField.typeIdentifier,
          fromNode,
          modelName,
          connectionField.fieldName)
        return {[getFieldNameFromModelName(modelName)]: fromNode}
      })
    }
  }

  if (schemaType === 'SIMPLE') {
    return simpleMutation(config,
      clientTypes[modelName].objectType,
      (root) => root[getFieldNameFromModelName(modelName)])
  } else {
    return mutationWithClientMutationId(config)
  }
}
