/* @flow */

import {
  GraphQLNonNull,
  GraphQLID,
  GraphQLObjectType
} from 'graphql'

import type {
  ClientTypes,
  ClientSchemaField,
  SchemaType
} from '../utils/definitions.js'

import {
  mutationWithClientMutationId,
  offsetToCursor
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
    name: `Add${connectionField.typeIdentifier}To${connectionField.fieldName}ConnectionOn${modelName}`,
    outputFields: {
      [getFieldNameFromModelName(modelName)]: {
        type: clientTypes[modelName].objectType,
        resolve: (root) => root.fromNode
      },
      viewer: {
        type: viewerType,
        resolve: (_, args, { rootValue: { backend } }) => (
          backend.user()
        )
      },
      edge: {
        type: clientTypes[connectionField.typeIdentifier].edgeType,
        resolve: (root) => ({
          cursor: offsetToCursor(0), // cursorForObjectInConnection(backend.allNodesByType(modelName), root.node),
          node: root.toNode
        })
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
      const fromFieldName = connectionField.fieldName
      const fromId = args.fromId
      const toType = connectionField.typeIdentifier
      const toFieldName = connectionField.backRelationName
      const toId = args.toId

      return backend.createRelation(fromType, fromFieldName, fromId, toType, toFieldName, toId)
      .then(({fromNode, toNode}) => {
        webhooksProcessor.nodeAddedToConnection(
          toNode,
          connectionField.typeIdentifier,
          fromNode,
          modelName,
          connectionField.fieldName)
        return {fromNode, toNode}
      })
    }
  }

  if (schemaType === 'SIMPLE') {
    return simpleMutation(config, clientTypes[modelName].objectType, (root) => root.fromNode)
  } else {
    return mutationWithClientMutationId(config)
  }
}
