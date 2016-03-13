/* @flow */

import {
  GraphQLID,
  GraphQLNonNull
} from 'graphql'

import {
  mutationWithClientMutationId,
  cursorForObjectInConnection,
  offsetToCursor
} from 'graphql-relay'

import type {
  GraphQLFields,
  AllTypes
} from '../utils/definitions.js'

const getFieldNameFromModelName = (modelName) => modelName.charAt(0).toLowerCase() + modelName.slice(1)

function getFieldsForBackRelations (args, clientSchema) {
  return clientSchema.fields.filter((field) => field.backRelationName && args[`${field.fieldName}Id`])
}

export function createMutationEndpoints (
  input: AllTypes
): GraphQLFields {
  const mutationFields = {}
  const clientTypes = input.clientTypes
  const viewerType = input.viewerType

  for (const modelName in clientTypes) {
    // create node
    mutationFields[`create${modelName}`] = mutationWithClientMutationId({
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
          resolve: (root, args, { rootValue: { backend } }) => backend.allNodesByType(modelName)
          .then((allNodes) => ({
            cursor: offsetToCursor(0), // todo: do we sort ascending or descending?
            node: root.node,
            viewer: backend.user()
          }))
        }
      },
      inputFields: clientTypes[modelName].createMutationInputArguments,
      mutateAndGetPayload: (node, { rootValue: { backend, webhooksProcessor } }) => {
        return backend.createNode(modelName, node)
        .then((node) => (
          // todo: also remove from backRelation when set to null
          // todo: also add to 1-many connection when updating node
          // add in corresponding 1-many connection
          Promise.all(getFieldsForBackRelations(node, clientTypes[modelName].clientSchema)
            .map((field) => backend.createRelation(
              field.typeIdentifier,
              node[`${field.fieldName}Id`],
              field.backRelationName,
              modelName,
              node.id))
            )
            .then(() => node)
        ))
        .then((node) => {
          webhooksProcessor.nodeCreated(node, modelName)
          return node
        })
        .then((node) => ({ node }))
      }
    })

    // update node
    // todo: make id input argument NOT NULL
    mutationFields[`update${modelName}`] = mutationWithClientMutationId({
      name: `Update${modelName}`,
      outputFields: {
        [getFieldNameFromModelName(modelName)]: {
          type: clientTypes[modelName].objectType
        },
        viewer: {
          type: viewerType,
          resolve: (_, args, { rootValue: { backend } }) => (
            backend.user()
          )
        },
        edge: {
          type: clientTypes[modelName].edgeType,
          resolve: (root, { rootValue: { backend } }) => ({
            cursor: cursorForObjectInConnection(backend.allNodesByType(modelName), root.node),
            node: root.node
          })
        }
      },
      inputFields: clientTypes[modelName].updateMutationInputArguments,
      mutateAndGetPayload: (node, { rootValue: { backend, webhooksProcessor } }) => {
        return backend.updateNode(modelName, node.id, node)
        .then((node) => {
          webhooksProcessor.nodeUpdated(node, modelName)
          return node
        })
        .then((node) => ({[getFieldNameFromModelName(modelName)]: node}))
      }
    })

    // delete node
    mutationFields[`delete${modelName}`] = mutationWithClientMutationId({
      name: `Delete${modelName}`,
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
        id: {
          type: new GraphQLNonNull(GraphQLID)
        }
      },
      mutateAndGetPayload: (node, { rootValue: { backend, webhooksProcessor } }) => {
        return backend.deleteNode(modelName, node.id)
        .then((node) => {
          webhooksProcessor.nodeDeleted(node, modelName)
          return node
        })
        .then((node) => ({[getFieldNameFromModelName(modelName)]: node}))
      }
    })

    const connectionFields = clientTypes[modelName].clientSchema.fields.filter((field) => field.isList)
    connectionFields.forEach((connectionField) => {
      mutationFields[`add${connectionField.typeIdentifier}To${connectionField.fieldName}ConnectionOn${modelName}`] =
        mutationWithClientMutationId({
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
          mutateAndGetPayload: (args, { rootValue: { backend, webhooksProcessor } }) => {
            return backend.createRelation(
              modelName,
              args.fromId,
              connectionField.fieldName,
              connectionField.typeIdentifier,
              args.toId)
            .then(({fromNode, toNode}) => {
              // todo: also remove from backRelation when removed from relation
              // add 1-1 connection if backRelation is present
              if(connectionField.backRelationName){
                toNode[`${connectionField.backRelationName}Id`] = args.fromId
                console.log('toNode', toNode)
                return backend.updateNode(connectionField.typeIdentifier, args.toId, toNode)
                .then((toNode) => ({fromNode, toNode}))
              }
              return {fromNode, toNode}
            })
            .then(({fromNode, toNode}) => {
              webhooksProcessor.nodeAddedToConnection(toNode, connectionField.typeIdentifier, fromNode, modelName, connectionField.fieldName)
              return {fromNode, toNode}
            })
            .then(({fromNode, toNode}) => ({fromNode, toNode}))
          }
        })
      const mutationName = `remove${connectionField.typeIdentifier}From` +
        `${connectionField.fieldName}ConnectionOn${modelName}`
      mutationFields[mutationName] = mutationWithClientMutationId({
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
        mutateAndGetPayload: (args, { rootValue: { backend, webhooksProcessor } }) => {
          return backend.removeRelation(
            modelName,
            args.fromId,
            connectionField.fieldName,
            connectionField.typeIdentifier,
            args.toId)
          .then(({fromNode, toNode}) => {
            console.log(fromNode, toNode)
            webhooksProcessor.nodeRemovedFromConnection(toNode, connectionField.typeIdentifier, fromNode, modelName, connectionField.fieldName)
            return {fromNode, toNode}
          })
          .then(({fromNode, toNode}) => ({[getFieldNameFromModelName(modelName)]: fromNode}))
        }
      })
    })
  }

  return mutationFields
}
