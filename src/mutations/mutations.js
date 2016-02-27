/* @flow */

import {
  GraphQLBoolean
} from 'graphql'

import type {
  ClientTypes,
  GraphQLFields
} from '../utils/definitions.js'

export function createMutationEndpoints (
  clientTypes: ClientTypes
): GraphQLFields {
  const mutationFields = {
    viewer: {
      type: GraphQLBoolean
    }
  }

  return mutationFields
}
