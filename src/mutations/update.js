/* @flow */

import type {
  ClientTypes,
  SchemaType
} from '../utils/definitions.js'

import {
  GraphQLObjectType
} from 'graphql'

import {
  mutationWithClientMutationId,
  cursorForObjectInConnection
} from 'graphql-relay'

import {
  getFieldNameFromModelName,
  convertInputFieldsToInternalIds,
  isScalar,
  convertIdToExternal,
  convertScalarListsToInternalRepresentation
} from '../utils/graphql.js'

import simpleMutation from './simpleMutation.js'

export default function (
  viewerType: GraphQLObjectType, clientTypes: ClientTypes, modelName: string, schemaType: SchemaType
  ): GraphQLObjectType {
  const config = {
    name: `Update${modelName}`,
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
        backend.allNodesByType(modelName, args, clientTypes[modelName].clientSchema, currentUser)
        .then(({array}) => {
          return ({
            // todo: getting all nodes is not efficient
            cursor: cursorForObjectInConnection(array, array.filter((x) => x.id === root.node.id)[0]),
            node: root.node
          })
        })
      }
    },
    inputFields: clientTypes[modelName].updateMutationInputArguments,
    mutateAndGetPayload: (node, { rootValue: { currentUser, backend, webhooksProcessor } }) => {
      // todo: currently we don't handle setting a relation to null. Use removeXfromConnection instead
      function getConnectionFields () {
        return clientTypes[modelName].clientSchema.fields
        .filter((field) => !isScalar(field.typeIdentifier) && node[`${field.fieldName}Id`] !== undefined)
      }

      function getScalarFields () {
        return clientTypes[modelName].clientSchema.fields
        .filter((field) => isScalar(field.typeIdentifier))
      }

      const externalId = node.id
      node = convertInputFieldsToInternalIds(node, clientTypes[modelName].clientSchema)

      return backend.node(
        modelName,
        node.id,
        clientTypes[modelName].clientSchema,
        currentUser)
      .then((oldNode) => {
        if (oldNode === null) {
          return Promise.reject(`'No ${modelName}' with id '${externalId}' exists`)
        }

        const changedFields = {}
        getScalarFields().forEach((field) => {
          if (node[field.fieldName] !== undefined && oldNode[field.fieldName] !== node[field.fieldName]) {
            changedFields[field.fieldName] = true
          } else {
            changedFields[field.fieldName] = false
          }
        })

        getScalarFields().forEach((field) => {
          if (node[field.fieldName] !== undefined) {
            oldNode[field.fieldName] = node[field.fieldName]
          }
        })

        oldNode = convertScalarListsToInternalRepresentation(oldNode, clientTypes[modelName].clientSchema)

        return backend.beginTransaction()
        .then(() => backend.updateNode(modelName, node.id, oldNode, clientTypes[modelName].clientSchema, currentUser))
        .then((dbNode) => {
          return Promise.all(getConnectionFields()
            .map((field) => {
              const fromType = modelName
              const fromId = dbNode.id
              const toType = field.typeIdentifier
              const toId = node[`${field.fieldName}Id`]

              const relation = field.relation

              const aId = field.relationSide === 'A' ? fromId : toId
              const bId = field.relationSide === 'B' ? fromId : toId
              const fromField = field.relationSide

              return backend.removeAllRelationsFrom(relation.id, fromType, fromId, fromField)
              .then(() => backend.createRelation(relation.id, aId, bId, fromType, fromId, toType, toId))
              .then(({fromNode, toNode}) => toNode)
            }))
          .then((connectedNodes) => {
            backend.commitTransaction()
            return {connectedNodes, node: dbNode, args: node}
          })
        })

        .then(({node, args}) => {
          return backend.getNodeWithoutUserValidation(modelName, node.id)
          .then((nodeWithAllFields) => {
            getConnectionFields().forEach((field) => {
              const fieldName = `${field.fieldName}Id`
              console.log(fieldName, args[fieldName])
              if (args[fieldName]) {
                nodeWithAllFields[fieldName] = args[fieldName]
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
            webhooksProcessor.nodeUpdated(convertIdToExternal(modelName, nodeWithAllFields), modelName, changedFields)
            return {node}
          })
        })
      })
    }
  }

  if (schemaType === 'SIMPLE') {
    return simpleMutation(config, clientTypes[modelName].objectType, (root) => root.node)
  } else {
    return mutationWithClientMutationId(config)
  }
}
