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

      function backRelationExists () {
        return connectionField.backRelationName &&
              !clientTypes[connectionField.typeIdentifier].clientSchema.fields
              .filter((x) => x.fieldName === connectionField.backRelationName)[0].isList
      }

      function removeBackRelation () {
        return backend.node(
          connectionField.typeIdentifier,
          args.toId,
          clientTypes[connectionField.typeIdentifier].clientSchema,
          currentUser)
        .then((toNode) => {
          toNode[`${connectionField.backRelationName}Id`] = null

          backend.updateNode(
            connectionField.typeIdentifier,
            args.toId,
            toNode,
            clientTypes[connectionField.typeIdentifier].clientSchema,
            currentUser)
        })
      }

      if (backend.type === 'sql') {
        const fromType = modelName
        const fromFieldName = connectionField.fieldName
        const fromId = args.fromId
        const toType = connectionField.typeIdentifier
        const toFieldName = connectionField.backRelationName
        const toId = args.toId

        return backend.removeRelation(fromType, fromFieldName, fromId, toType, toFieldName, toId)
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

      return (backRelationExists()
      ? removeBackRelation()
      : Promise.resolve()
      ).then(() =>
        backend.removeRelation(
          modelName,
          args.fromId,
          connectionField.fieldName,
          connectionField.typeIdentifier,
          args.toId))
      .then(({fromNode, toNode}) => {
        webhooksProcessor.nodeRemovedFromConnection(
          toNode,
          connectionField.typeIdentifier,
          fromNode,
          modelName,
          connectionField.fieldName)
        return {fromNode, toNode}
      })
      .then(({fromNode, toNode}) => ({[getFieldNameFromModelName(modelName)]: fromNode}))
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
