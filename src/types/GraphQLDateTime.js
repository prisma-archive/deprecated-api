import { GraphQLScalarType } from 'graphql'
import { GraphQLError } from 'graphql/error'
import { Kind } from 'graphql/language'
import moment from 'moment'

const ISO8601 = 'YYYY-MM-DDTHH:MM:SS.SSSZ'

export function isValidDateTime (dateTime: string): boolean {
  return (
    moment(dateTime).isValid()
  )
}

function coerceDate (value) {
  if (!(value instanceof Date)) {
    throw new Error('Field error: value is not an instance of Date')
  }

  const result = moment(value).format(ISO8601)
  console.log(result)
  if (!isValidDateTime(result)) {
    throw new Error('Field error: value is an invalid Date')
  }

  return result
}

export default new GraphQLScalarType({
  name: 'DateTime',
  serialize: coerceDate,
  parseValue: coerceDate,
  parseLiteral (ast) {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError('Query error: Can only parse strings to dates but got a: ' + ast.kind, [ast])
    }

    const result = moment(ast.value)
    if (!result.isValid()) {
      throw new GraphQLError(`Query error: Invalid date format, only accepts: ${ISO8601}`, [ast])
    }

    console.log(ast.value)
    console.log(result)

    return result.toDate()
  }
})
