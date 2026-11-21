# Coding Standards and Guidelines

This document defines the coding standards, formatting rules, design principles, and development practices used in this project. The goal is to ensure consistent, readable, maintainable, and high-quality code across the team.

---

# Code Readability and Comments

Code should be written in a way that is **self-explanatory and easy to understand without excessive comments**. Prioritize clarity and simplicity.

## General Principles

- Use **clear, descriptive, and concise variable names** that communicate their purpose.
- Avoid overly long or cryptic names.
- Prefer simplicity over clever or complex solutions unless it improves software attributes such as performance.
- Write code that is easy to follow for someone unfamiliar with the implementation.


## When to Use Comments

Comments should be used only when they add value and clarify intent. Avoid redundant comments that restate obvious code behavior.

Use comments to:

- Clarify **intent** when it may not be obvious from the code itself.
- Document **public APIs**, including:
  - Purpose
  - Parameters
  - Return values
  - Expected behavior
- Warn about **important consequences, side effects, or limitations**
- Add **TODO comments** for planned improvements or incomplete work

Avoid:

- Commenting obvious code
- Writing excessive or unnecessary comments

Example:

```python
# Good: explains intent
# Cache result to avoid repeated expensive database queries
cached_user = get_user_from_cache(user_id)

# Bad: obvious comment
# Assign value to variable
x = 10
```
# Code formatting rules
We use Flake8 to enforce formatting standards in python, and ... and ... in JavaScript and HTML respectively to enforce formatting such as:
* Indentation
* Spacing
* Line length
* Syntax correctness

However, since these tools does not enforce all formatting rules, additional formatting conventions must be followed.

# Vertical Density (Grouping Related Code)

Group lines of code that belong to the same logical concept closely together. Separate unrelated concepts with blank lines to improve readability.

```python
# Good
total = price * quantity
tax = total * TAX_RATE
final_price = total + tax

log_transaction(final_price)
send_receipt()

# Bad
total = price * quantity

tax = total * TAX_RATE


final_price = total + tax

```

# Vertical Ordering Inside Classes
Class contents must be ordered as follows:
* Instance variables
* Public methods
* Private methods

Example:
```python
class OrderProcessor:

    def __init__(self, database):
        self.database = database
        self.cache = {}


    def process_order(self, order):
        validated = self._validate_order(order)
        self._save_order(validated)


    def _validate_order(self, order):
        return order


    def _save_order(self, order):
        self.database.save(order)

```
Remark that methods that starts with _ are private while those that does not are public.

# Classes, Functions, and Abstractions
Use appropriate abstractions based on the responsibility and scope of the functionality.

## When to Use Functions
Use a function when:
* The logic performs a single, well-defined task
* No persistent state is required
* The functionality is simple and independent

```python
def calculate_total(price, quantity):
    return price * quantity
```

## When to Use Classes
Use a class when:
* Variables and functions must work together to provide a service
* State must be stored and maintained

```python
class UserService:

    def __init__(self, database):
        self.database = database

    def get_user(self, user_id):
        return self.database.fetch(user_id)

```
# Naming conventions for variables, functions, classes, etc. 
We follow the naming convention specified by PEP8, i.e:
- Variables --> snake_case
- Functions --> snake_case
- constants --> UPPER_SNAKE_CASE
- Classes --> PascalCase
- private methods --> snake_case with leading underscore (_)
- files --> snake_case
- packages --> lowercase

# Cohesion and Coupling
Classes and functions should follow these principles:
* High Cohesion
* Each class or function should have a single, clear responsibility
* Related functionality should be grouped together
* Loose Coupling
* Minimize dependencies between components
* Avoid tightly linking components unnecessarily
* Make components easier to modify, test, and reuse

# Design Patterns
Design patterns should be introduced when they provide clear benefits such as:
* Improved maintainability
* Better separation of concerns
* Increased flexibility


Design patterns must not be used unnecessarily or prematurely. Before introducing a design pattern:
Discuss the proposal with team members


# Testing
Tests are essential to ensure correctness, stability, and maintainability. Tests should:
* Verify expected behavior
* Cover critical logic
* Be easy to understand and maintain
* Be isolated and independent
* Types of tests include:
    * Unit tests
    * Tests should be written alongside or shortly after implementing functionality.

Note that the web application (sw) is currently tested manually, as it is relatively small and contains limited functionality.

# Dependencies and Environment Management
We use Python virtual environments (venv) and npm to isolate project dependencies for our python and web applications. Remark that npm registers dependenices automatically in `sw/backend/package.json` upon installation.


## Requirements
* All dependencies must be installed inside a virtual environment
* All python dependencies must be documented in: `ml/api/requirements.txt`


## Adding New Dependencies
When adding a new dependency:
* Install it in the virtual environment using `pip install <PACKAGE>` (python)
* Update requirements.txt (python)
* Run `npm install <PACKAGE>` for web application. Any installed packages are automatically saved in a `package.json` file


# Peer review
* Peer review is required to maintain high code quality and consistency.
* Peer review focuses on:
    * Code readability
    * Correctness
    * Maintainability
    * Adherence to coding standards
    * Proper use of abstractions and design patterns
* Peer review is especially important for:
    * Archtectural changes
    * New abstractions
    * Introduction of design patterns
    * Complex logic