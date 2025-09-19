#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Checking for problems in src/ directory...${NC}"
echo ""

# Initialize counters
total_errors=0
total_warnings=0
total_files=0
files_with_issues=0

# Function to check a single file for common issues (grep-based checks only)
check_file() {
    local file="$1"
    local relative_path="${file#./src/}"
    
    # Check if file exists
    if [[ ! -f "$file" ]]; then
        echo -e "${RED}❌ File not found: $file${NC}"
        return 1
    fi
    
    # Count common issues
    local common_issues=()
    
    # Check for console.log statements (potential debug code)
    if grep -q "console\.log" "$file"; then
        echo -e "${YELLOW}⚠️  $relative_path: console.log statements found${NC}"
        common_issues+=("console.log statements found")
    fi
    
    # Check for console.error statements
    if grep -q "console\.error" "$file"; then
        echo -e "${YELLOW}⚠️  $relative_path: console.error statements found${NC}"
        common_issues+=("console.error statements found")
    fi
    
    # Check for TODO comments
    if grep -q "TODO\|FIXME\|HACK" "$file"; then
        echo -e "${YELLOW}⚠️  $relative_path: TODO/FIXME/HACK comments found${NC}"
        common_issues+=("TODO/FIXME/HACK comments found")
    fi
    
    # Check for unsafe type assertions
    if grep -q "as any" "$file"; then
        echo -e "${YELLOW}⚠️  $relative_path: Unsafe 'as any' type assertions found${NC}"
        common_issues+=("Unsafe 'as any' type assertions found")
    fi
    
    # Check for missing return types on functions
    if grep -q "function.*(" "$file" && ! grep -q ":.*{" "$file"; then
        echo -e "${YELLOW}⚠️  $relative_path: Functions may be missing return types${NC}"
        common_issues+=("Functions may be missing return types")
    fi
    
    # Check for type-only import issues (when verbatimModuleSyntax is enabled)
    if grep -q "import.*{.*}.*from" "$file" && ! grep -q "import type" "$file"; then
        # Check if any imports might need to be type-only
        if grep -q "import.*{.*[A-Z].*}" "$file"; then
            echo -e "${YELLOW}⚠️  $relative_path: Potential type-only import needed${NC}"
            common_issues+=("Potential type-only import needed")
        fi
    fi
    
    # Check for unused imports
    if grep -q "import.*{.*}" "$file"; then
        echo -e "${YELLOW}⚠️  $relative_path: Check for unused imports${NC}"
        common_issues+=("Check for unused imports")
    fi
    
    # Update counters
    if [[ ${#common_issues[@]} -gt 0 ]]; then
        ((files_with_issues++))
    fi
    
    ((total_files++))
}

# Main execution
echo -e "${BLUE}🚀 Starting comprehensive problem check...${NC}"
echo ""

# First, run a project-wide TypeScript check using the build script
echo -e "${BLUE}🔍 Running project-wide TypeScript check...${NC}"
project_ts_errors=$(pnpm run build 2>&1)
project_ts_exit_code=$?

if [[ $project_ts_exit_code -ne 0 && -n "$project_ts_errors" ]]; then
    echo -e "${RED}Project-wide TypeScript Issues:${NC}"
    while IFS= read -r line; do
        if [[ "$line" =~ error ]]; then
            echo -e "${RED}  ❌ $line${NC}"
            ((total_errors++))
        elif [[ "$line" =~ warning ]]; then
            echo -e "${YELLOW}  ⚠️  $line${NC}"
            ((total_warnings++))
        else
            echo -e "${YELLOW}  ℹ️  $line${NC}"
        fi
    done <<< "$project_ts_errors"
    echo ""
else
    echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
fi

# Check all TypeScript files for common issues (grep-based checks)
echo -e "${BLUE}🔍 Checking for common issues...${NC}"
while IFS= read -r file; do
    check_file "$file"
done < <(find ./src -name "*.ts" -type f | sort)

# Final summary
echo ""
echo -e "${BLUE}📊 === FINAL SUMMARY ===${NC}"
echo -e "${BLUE}📁 Total files checked: ${total_files}${NC}"
echo -e "${RED}❌ Total errors: ${total_errors}${NC}"
echo -e "${YELLOW}⚠️  Total warnings: ${total_warnings}${NC}"
echo -e "${YELLOW}📂 Files with issues: ${files_with_issues}${NC}"

if [[ $total_errors -eq 0 ]]; then
    echo -e "${GREEN}🎉 No TypeScript errors found!${NC}"
    if [[ $files_with_issues -gt 0 ]]; then
        echo -e "${YELLOW}ℹ️  ${files_with_issues} files have minor warnings (non-blocking)${NC}"
    fi
    exit 0
else
    echo -e "${RED}⚠️  TypeScript errors found. Please review the output above.${NC}"
    exit 1
fi