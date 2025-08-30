# Create deployment package for Lambda
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../auth-server"
  output_path = "${path.module}/lambda_function.zip"
  
  excludes = [
    # Environment and config files
    ".env",
    ".env.local",
    ".env.example",
    ".gitignore",
    ".eslintrc.json",
    ".prettierrc",
    
    # Documentation
    "README.md",
    "*.md",
    
    # Test files and directories
    "test/**",
    "tests/**",
    "**/*.test.js",
    "**/*.spec.js",
    "jest.config.js",
    "coverage/**",
    "__tests__/**",
    
    # Development dependencies and cache
    ".nyc_output/**",
    ".vscode/**",
    ".idea/**",
    "*.log",
    "npm-debug.log*",
    "yarn-debug.log*",
    "yarn-error.log*",
    
    # Git files
    ".git/**",
    ".github/**",
    
    # Package manager files (we only need node_modules)
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    
    # Temporary and build files
    "tmp/**",
    "temp/**",
    "dist/**",
    "build/**",
    "*.tmp",
    "*.bak",
    "*.swp",
    ".DS_Store",
    "Thumbs.db"
  ]
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Get current AWS region
data "aws_region" "current" {}