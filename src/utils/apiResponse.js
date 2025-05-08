class ApiResponse {
  static success(data = null, message = 'Success', statusCode = 200) {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  static error(message = 'Error', errors = null, statusCode = 400) {
    return {
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString()
    };
  }

  static validationError(errors) {
    return {
      success: false,
      message: 'Validation Error',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      })),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ApiResponse; 