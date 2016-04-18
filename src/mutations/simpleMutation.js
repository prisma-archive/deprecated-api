export default function simpleMutation (config, outputType, outputResolve) {
  var {inputFields, mutateAndGetPayload} = config

  return {
    type: outputType,
    args: inputFields,
    resolve: (_, input, context, info) => {
      return Promise.resolve(mutateAndGetPayload(input, context, info))
        .then((payload) => {
          return outputResolve(payload)
        })
    }
  }
}
