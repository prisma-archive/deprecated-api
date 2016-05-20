/* @flow */

import {
  GraphQLObjectType
} from 'graphql'

import type {
  ClientTypes,
  SchemaType
} from '../utils/definitions.js'

import {
  mutationWithClientMutationId,
  offsetToCursor
} from 'graphql-relay'

import {
  getFieldNameFromModelName,
  patchConnectedNodesOnIdFields,
  convertInputFieldsToInternalIds,
  convertIdToExternal,
  isScalar
} from '../utils/graphql.js'

import simpleMutation from './simpleMutation.js'

function getFieldsOfType (args, clientSchema, typeIdentifier) {
  return clientSchema.fields.filter((field) => field.typeIdentifier === typeIdentifier && args[field.fieldName])
}

export default function (
  viewerType: GraphQLObjectType, clientTypes: ClientTypes, modelName: string, schemaType: SchemaType
  ): GraphQLObjectType {
  const config = {
    name: `Create${modelName}`,
    outputFields: {
      [getFieldNameFromModelName(modelName)]: {
        type: clientTypes[modelName].objectType,
        resolve: (root) => root.node
      },
      viewer: {
        type: viewerType,
        resolve: (_, args, { rootValue: { backend } }) => (
          backend.user()
        )
      },
      edge: {
        type: clientTypes[modelName].edgeType,
        resolve: (root, args, { rootValue: { currentUser, backend } }) =>
        ({
          cursor: offsetToCursor(0), // todo: do we sort ascending or descending?
          node: root.node,
          viewer: backend.user()
        })
      }
    },
    inputFields: clientTypes[modelName].createMutationInputArguments,
    mutateAndGetPayload: (node, { rootValue: { currentUser, backend, webhooksProcessor } }) => {
      
      console.log('NODE', node)

      function getConnectionFields () {
        return clientTypes[modelName].clientSchema.fields
        .filter((field) => !isScalar(field.typeIdentifier) && node[`${field.fieldName}Id`] !== undefined)
      }

      function getScalarFields () {
        return clientTypes[modelName].clientSchema.fields
        .filter((field) => isScalar(field.typeIdentifier))
      }

      node = convertInputFieldsToInternalIds(node, clientTypes[modelName].clientSchema)

      console.log('NODE1', node)
      return Promise.all(getFieldsOfType(node, clientTypes[modelName].clientSchema, 'Password').map((field) =>
        backend.hashAsync(node[field.fieldName]).then((hashed) => {
          node[field.fieldName] = hashed
        })
      ))
      .then(() => {
        console.log('NODE2', node)
        const newNode = {}
        getScalarFields().forEach((field) => {
          if (node[field.fieldName] !== undefined) {
            newNode[field.fieldName] = node[field.fieldName]
          }
        })
        console.log('NODE3', node, newNode)
        return backend.createNode(modelName, newNode, clientTypes[modelName].clientSchema, currentUser)
      }).then((dbNode) => (
        // add in corresponding connection
        Promise.all(getConnectionFields()
          .map((field) => {
            const fromType = modelName
            const fromId = dbNode.id
            const toType = field.typeIdentifier
            const toId = node[`${field.fieldName}Id`]

            const relation = field.relation

            const aId = field.relationSide === 'A' ? fromId : toId
            const bId = field.relationSide === 'B' ? fromId : toId

            return backend.createRelation(relation.id, aId, bId, fromType, fromId, toType, toId)
            .then(({fromNode, toNode}) => toNode)
          })
        )
        .then((connectedNodes) => ({connectedNodes, node}))
      ))
      .then(({connectedNodes, node}) => {
        const patchedNode = patchConnectedNodesOnIdFields(node, connectedNodes, clientTypes[modelName].clientSchema)
        webhooksProcessor.nodeCreated(convertIdToExternal(modelName, patchedNode), modelName)
        return node
      })
      .then((node) => ({ node }))
    }
  }

  if (schemaType === 'SIMPLE') {
    return simpleMutation(config, clientTypes[modelName].objectType, (root) => root.node)
  } else {
    return mutationWithClientMutationId(config)
  }
}
