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
  isScalar,
  convertScalarListsToInternalRepresentation
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
      function getConnectionFields () {
        return clientTypes[modelName].clientSchema.fields
        .filter((field) => !isScalar(field.typeIdentifier) && node[`${field.fieldName}Id`] !== undefined)
      }

      function getScalarFields () {
        return clientTypes[modelName].clientSchema.fields
        .filter((field) => isScalar(field.typeIdentifier))
      }

      node = convertInputFieldsToInternalIds(node, clientTypes[modelName].clientSchema)

      return Promise.all(getFieldsOfType(node, clientTypes[modelName].clientSchema, 'Password').map((field) =>
        backend.hashAsync(node[field.fieldName]).then((hashed) => {
          node[field.fieldName] = hashed
        })
      ))
      .then(() => {
        let newNode = {}
        getScalarFields().forEach((field) => {
          if (node[field.fieldName] !== undefined) {
            newNode[field.fieldName] = node[field.fieldName]
          }
        })

        newNode = convertScalarListsToInternalRepresentation(newNode, clientTypes[modelName].clientSchema)

        return backend.beginTransaction()
        .then(() => backend.createNode(modelName, newNode, clientTypes[modelName].clientSchema, currentUser))
      }).then((dbNode) => {
        node.id = dbNode.id
        // add in corresponding connection
        return Promise.all(getConnectionFields()
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
        .then((connectedNodes) => {
          backend.commitTransaction()
          return {connectedNodes, node}
        })
      })
      .then(({connectedNodes, node}) => {
        return backend.getNodeWithoutUserValidation(modelName, node.id)
        .then((nodeWithAllFields) => {
          getConnectionFields().forEach((field) => {
            const fieldName = `${field.fieldName}Id`
            console.log(fieldName, node[fieldName])
            if (node[fieldName]) {
              nodeWithAllFields[fieldName] = node[fieldName]
            }
          })

          getScalarFields().forEach((field) => {
            if (field.typeIdentifier === 'Boolean') {
              if (nodeWithAllFields[field.fieldName] === 0) {
                nodeWithAllFields[field.fieldName] = false
              }
              if (nodeWithAllFields[field.fieldName] === 1) {
                nodeWithAllFields[field.fieldName] = true
              }
            }
          })
          const patchedNode = patchConnectedNodesOnIdFields(
            nodeWithAllFields,
            connectedNodes,
            clientTypes[modelName].clientSchema)
          webhooksProcessor.nodeCreated(convertIdToExternal(modelName, patchedNode), modelName)
          return node
        })
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
