/* @flow */

import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLNonNull
} from 'graphql'

import {
  mutationWithClientMutationId
} from 'graphql-relay'

import type {
  ClientTypes,
  GraphQLFields
} from '../utils/definitions.js'

export function createMutationEndpoints (
  clientTypes: ClientTypes
): GraphQLFields {
  const mutationFields = {}

  for (const modelName in clientTypes) {
    // create node
    mutationFields[`create${modelName}`] = mutationWithClientMutationId({
      name: `Create${modelName}`,
      outputFields: { node: {type: clientTypes[modelName].objectType} },
      inputFields: clientTypes[modelName].mutationInputArguments,
      mutateAndGetPayload: (node, { rootValue: { backend } }) => {
        
        return backend.createNode(modelName, node).then(node => ({node}))
      }
    })

    // update node
    // todo: make id input argument NOT NULL
    mutationFields[`update${modelName}`] = mutationWithClientMutationId({
      name: `Update${modelName}`,
      outputFields: { node: {type: clientTypes[modelName].objectType} },
      inputFields: clientTypes[modelName].mutationInputArguments,
      mutateAndGetPayload: (node, { rootValue: { backend } }) => {
        
        return backend.updateNode(modelName, node.id, node).then(node => ({node}))
      }
    })

    // delete node
    mutationFields[`delete${modelName}`] = mutationWithClientMutationId({
      name: `Delete${modelName}`,
      outputFields: { node: {type: clientTypes[modelName].objectType} },
      inputFields: { id: {type: new GraphQLNonNull(GraphQLID)}},
      mutateAndGetPayload: (node, { rootValue: { backend } }) => {
        
        return backend.deleteNode(modelName, node.id).then(node => ({node}))
      }
    })
  }

  return mutationFields
}
