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
  convertIdToExternal } from '../utils/graphql.js'

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
      node = convertInputFieldsToInternalIds(node, clientTypes[modelName].clientSchema)

      function getBackRelationNodes (relationField, originalNode) {
        if (relationField.isList) {
          return backend.allNodesByRelation(
            modelName,
            originalNode.id,
            relationField.fieldName,
            null,
            clientTypes[modelName].clientSchema,
            currentUser)
          .then((nodes) => nodes.filter((node) => node !== null))
        } else {
          if (!originalNode[`${relationField.fieldName}Id`]) {
            return Promise.resolve([])
          }
          return backend.node(
            relationField.typeIdentifier,
            originalNode[`${relationField.fieldName}Id`],
            clientTypes[relationField.typeIdentifier].clientSchema,
            currentUser).then((node) => node ? [node] : [])
        }
      }

      function getChangedRelationFields (oldNode, updateNode) {
        const relationFields = clientTypes[modelName].clientSchema.fields
          .filter((field) => field.backRelationName)

        return relationFields.filter((relationField) =>
          updateNode[`${relationField.fieldName}Id`] !== undefined &&
          oldNode[`${relationField.fieldName}Id`] !== updateNode[`${relationField.fieldName}Id`])
      }

      function removeConnections (relationNodes, field, backRelationField) {
        return Promise.all(relationNodes.map((relationNode) => {
          if (!backRelationField.isList) {
            relationNode[`${field.backRelationName}Id`] = null
            return backend.updateNode(
              field.typeIdentifier,
              relationNode.id,
              relationNode,
              clientTypes[field.typeIdentifier].clientSchema,
              currentUser)
          } else {
            return backend.removeRelation(
              field.typeIdentifier,
              relationNode.id,
              backRelationField.fieldName,
              modelName,
              node.id)
          }
        }))
      }

      function addConnections (relationNodes, field, backRelationField) {
        return Promise.all(relationNodes.map((relationNode) => {
          if (backRelationField.isList) {
            return backend.createRelation(
              field.typeIdentifier,
              node[`${field.fieldName}Id`],
              field.backRelationName,
              modelName,
              node.id)
            .then(({fromNode, toNode}) => fromNode)
          } else {
            relationNode[`${field.backRelationName}Id`] = node.id
            return backend.updateNode(
              field.typeIdentifier,
              relationNode.id,
              relationNode,
              clientTypes[field.typeIdentifier].clientSchema,
              currentUser)
          }
        }))
      }

      return backend.node(
        modelName,
        node.id,
        clientTypes[modelName].clientSchema,
        currentUser)
      .then((oldNode) => {
        if (oldNode === null) {
          return Promise.reject(`'No ${modelName}' with id '${node.id}' exists`)
        }

        const changedRelationFields = getChangedRelationFields(oldNode, node)

        return (backend.type === 'sql'
        // todo: patch relations
        ? Promise.resolve([])
        : Promise.all(changedRelationFields.map((field) => {
          const backRelationField = clientTypes[field.typeIdentifier].clientSchema.fields
          .filter((x) => x.fieldName === field.backRelationName)[0]

          return getBackRelationNodes(field, oldNode)
          .then((relationNodes) => {
            return Promise.all([
              // todo: make these work with sql backend
              removeConnections(relationNodes, field, backRelationField),
              addConnections(relationNodes, field, backRelationField)
            ])
          })
        })))
        .then(() =>
          backend.updateNode(modelName, node.id, node, clientTypes[modelName].clientSchema, currentUser)
          .then((node) => {
            webhooksProcessor.nodeUpdated(convertIdToExternal(modelName, node), modelName)
            return {node}
          })
        )
      })
    }
  }

  if (schemaType === 'SIMPLE') {
    return simpleMutation(config, clientTypes[modelName].objectType, (root) => root.node)
  } else {
    return mutationWithClientMutationId(config)
  }
}
