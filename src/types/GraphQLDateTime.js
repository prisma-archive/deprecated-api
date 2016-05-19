import { GraphQLScalarType } from 'graphql'
import { GraphQLError } from 'graphql/error'
import { Kind } from 'graphql/language'
import moment from 'moment'

const ISO8601 = 'YYYY-MM-DDTHH:mm:ss.SSSZ'

export function isValidDateTime (dateTime: string): boolean {
  if (!dateTime) {
    return false
  }

  return _parseAsMoment(dateTime).isValid()
}

function _parseAsMoment (value) {
  return moment.utc(value, ISO8601)
}

export default new GraphQLScalarType({
  name: 'DateTime',
  serialize: (value) => { return value },
  parseValue: (value) => { return value },
  parseLiteral (ast) {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError('Query error: Can only parse strings to dates but got a: ' + ast.kind, [ast])
    }

    if (!isValidDateTime(ast.value)) {
      throw new GraphQLError(`Query error: Invalid date format, only accepts: ${ISO8601}`, [ast])
    }

    return _parseAsMoment(ast.value).format(ISO8601)
  }
})
