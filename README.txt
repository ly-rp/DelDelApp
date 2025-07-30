We are currently making a recipe app named Delectable Delights, aka DelDel. It is an app where users can browse, favorite and leave ratings on recipes made as either a registered user or a guest. The roles we are implementing will thus be admin, registered users and guest users.

The codes written are currently being shared across the team using both GitHub and a messaging group. 

Current progress in our VS Code project includes the following:

The "views" folder contains the following files:
- welcome.ejs: The homepage which should have features to login, register or sign in as guest
- login.ejs, register.ejs: User authentication
- addRecipe.ejs: Where users can add new recipes
- editRecipe.ejs: Where users can edit existing recipes
- dashboard.ejs, admin.ejs, guest.ejs, user.ejs: Displays different role's dashboard contents. Still a work in progress. 
- All EJS routes ending with 'Lists', recipes.ejs and myRecipes.ejs: Display of lists of the different recipes either fully or categorised by their food type (Breakfast, Side Dishes, Soups, Desserts, Salads)
- favourites.ejs: A route that will show a registered user their favourited recipes
- recipe.ejs: Display route of a singular recipe. 

The "public" folder includes the "images" folder adn

The "app.js" is included, and the Database connection is already coded in, but entire code is also still a work in progress. 

Enhancements we wish to include into the app are:
- Guest users, a role that can only see recipes and cannot leave ratings nor upload recipes 
- User Profiles for Registered Users
- Favouriting of recipes for Registered Users
- Working GIF in Welcome Page 
- Aesthetic CSS makeover
- Ability to see your own recipes in the My Recipes Page
- 