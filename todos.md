Styling section 
-
Rewrite the css and make changes in theme

database section
-
- create db schema and connect it

- handle all the endpoints

changes in admin/dashboard
-
- add the functionality of viewsing all songs after cliking on the card
- handle manage songs dropdown menu which will act uponly
- handle all the routes on song and albums


- views changes
change css for all ejs files and make css more better and eye catchy
-

-songs-card
make songs cards more interative like if anyone clicks on any card specific card will open with that song containg all meta data and properties with along side its playing and pausing and downloaing option
song card should has a img at background 

-add login failed.ejs file 



<!-- notes -->

csscLinking code : <link rel="stylesheet" href="/styles/admin/dashboard.css"> 

-

UPDATE songs
SET album_id = (SELECT id FROM albums WHERE title = 'Album Title')
WHERE song_title = 'Song Title';


todo: Resolve the array problem while adding songs to album : resolved

<html>
    <body>
        <script>
            alert("Album Deleted Successfully....");
                        window.location.href = "/admin/dashboard"; // Redirect to the home page
        </script>
    </body>
</html>

                


add search song functionality
add admin navbar in admin side


<!-- primary font -->
 font-family: "JetBrains Mono", monospace;


 -
- add pagination to home page 
- add albums section in navbar/header 
- handle promotions : handled
- change css for audio controls 

- 
sort promotions according to newest first
handle all questions


---

Future Enhancement
- Add Charts for anaylitics for admin using library called charts.js
- Add Pagination to Songs and albums
- Add manual categories for admin (Admin can add categoris)
- Enhance UI
- Adding Paid Albums/Songs using USER LOGIN/Registering