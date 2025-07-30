We are currently making a recipe app named Delectable Delights, aka DelDel. It is an app where users can browse, favorite and leave ratings on recipes made as either a registered user or a guest. The roles we are implementing will thus be admin, registered users and guest users.

The codes written are currently being shared across the team using both GitHub and a messaging group. 

Current progress in our VS Code project includes the following:

The "views" folder contains the following files:
- /partials: navbar.ejs, home.ejs, recipeCards.ejs ()
- welcome.ejs: The homepage which should have features to login, register or sign in as guest
- register.ejs:
- login.ejs, register.ejs, forgot-password.ejs: User authentication
- guest.ejs, user.ejs, admin.ejs: 
- addRecipe.ejs: Where users can add new recipes
- editRecipe.ejs: Where users can edit existing recipes
- All EJS routes ending with 'Lists', recipes.ejs and myRecipes.ejs: Display of lists of the different recipes either fully or categorised by their food type (Breakfast, Side Dishes, Soups, Desserts, Salads)
- recipe.ejs: Display route of a singular recipe. 
- favourites.ejs: A route that will show a registered user their favourited recipes
- review.ejs:
- searchResults.ejs: The search bar of the navbar that implements search filtering
- forgot-password.ejs: The forgot password page where users can change their password with security questions


The "public" folder includes the "images" folder adn

The "app.js" is included, and the Database connection is already coded in, but entire code is also still a work in progress. 

Enhancements we wish to include into the app are:
- Guest users, a role that can only see recipes and cannot leave ratings nor upload recipes 
- User Profiles for Registered Users
- Favouriting of recipes for Registered Users
- Working GIF in Welcome Page 
- Aesthetic CSS makeover
- Ability to see your own recipes in the My Recipes Page
- Forget password