from app import create_app
from app.config import Config

# Create the application instance using default or production config
app = create_app()

if __name__ == "__main__":
    app.run()
