import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';
import multer from 'multer';
import session from 'express-session';
import path, { parse } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const app = express();
const PORT = 3000;

//-------------------- multer setup for file handling --------------------------
// for uploading single song
const upload = multer({ dest: 'uploads/' })
//for uploading album cover image
const uploadAlbum = multer({ dest: "uploads/albumCovers" })

// -----------------------------*******-----------------------------------------

app.use(session({
    secret: 'SECRET', // secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if   

}))

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    port: 5432,
    password: "4141",
    database: "UnreleasedBeats"
});

db.connect();


app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({ extended: 'true' }));


//custom middleware 


// ********************* Home Route ***************************************
app.get("/", async (req, res) => {
    const query = "SELECT * FROM songs";
    const result = await db.query(query);
    // console.log(result.rows);
    let allSongs = result.rows;
    res.render("home", { allSongs });
})

//------------------------- categories section ------------------------

app.get("/categories/:category", async (req, res) => {
    const category = req.params.category;
    try {
        const query = "SELECT * FROM songs WHERE category = $1";
        const result = await db.query(query, [category]);
        const allSongs = result.rows;
        console.log(category);
        console.log(result.rows);

        res.render("category", { allSongs });
    } catch (err) {
        console.error('Error fetching songs:', err);
        res.status(500).send('Server error');
    }
});

//------------------------------------------------------------------------

// -------------------- Login & Logout Section -----------------------------
app.get("/adminLogin", (req, res) => {
    res.render("admin/adminForm.ejs");
})

app.get("/logout", (req, res) => {
    res.render("admin/adminForm");
})
// admin login post
app.post("/adminLogin", async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    console.log(username);
    console.log(password);


    try {
        const query = "SELECT * FROM admin WHERE username=$1 AND password=$2";
        const values = [username, password];
        let result = await db.query(query, values);
        if (result.rows.length > 0) {
            console.log("Login Successs");
            req.session.admin = true;
            res.redirect('admin/dashboard');
        }
        else {
            res.render("admin/loginFailed.ejs")
        }
    } catch (error) {
        console.log(error);
    }


})
// ---------------------------------------------------------------------------



// --------------------- Playing and Downloading --------------------------------
app.get("/play/:id", async (req, res) => {
    const songId = req.params.id;
    try {
        const result = await db.query('SELECT * FROM songs WHERE id = $1', [songId]);
        if (result.rows.length > 0) {
            const songFilePath = result.rows[0].file_path;
            const fullFilePath = path.join(__dirname, songFilePath);

            // Check if file exists
            if (fs.existsSync(fullFilePath)) {
                res.setHeader('Content-Type', 'audio/mpeg');
                const readStream = fs.createReadStream(fullFilePath);
                readStream.pipe(res);
            } else {
                res.status(404).send('File not found');
            }
        } else {
            res.status(404).send('Song not found');
        }
    } catch (err) {
        console.error('Error fetching song:', err);
        res.status(500).send('Server error');
    }
})

// route for handling downloding 
app.get("/download/:id", async (req, res) => {
    const songId = req.params.id;
    try {
        const result = await db.query('SELECT * FROM songs WHERE id = $1', [songId]);
        if (result.rows.length > 0) {
            const songFilePath = result.rows[0].file_path;
            const fullFilePath = path.join(__dirname, songFilePath);

            // Check if file exists
            if (fs.existsSync(fullFilePath)) {
                res.download(fullFilePath, result.rows[0].song_title, (err) => {
                    if (err) {
                        console.error('Error downloading file:', err);
                        res.status(500).send('Server error');
                    }
                });
            } else {
                res.status(404).send('File not found');
            }
        } else {
            res.status(404).send('Song not found');
        }
    } catch (err) {
        console.error('Error fetching song:', err);
        res.status(500).send('Server error');
    }
});


// ------------------------------------------------------------------------------


// ---------------------- *** admin section *** ---------------------------------------
app.get('/admin/dashboard', async (req, res) => {
    // Fetch data from database
    // let totalSongs = 20; //replace with dyanamic
    const successMessage = req.session.successMessage;
    req.session.successMessage = null; // Clear the message after retrieving it
    let pendingApprovals = 12;
    let totalQuestions = 10;

    let query = "SELECT * FROM songs";
    let result = await db.query(query);
    let totalSongs = result.rowCount;
    // console.log(totalSongs)
    // console.log(req.session)

    // query for the totalQuestions
    let questions = "SELECT * FROM contact_us";
    let resultQuestions = db.query(questions);
    totalQuestions = (await resultQuestions).rowCount;

    //  total albums
    
    let albums =  "SELECT * FROM albums";
    let resAlubms = db.query(albums);
    let totalAlbums = (await resAlubms).rowCount;

    if (req.session.admin) {
        // console.log(totalSongs, totalAlbums, pendingApprovals)
        res.render('admin/dashboard', { totalSongs, totalAlbums, pendingApprovals, totalQuestions });
    }
    else {
        res.render('admin/adminForm.ejs'); // Redirect to login if not authorized
    }


});


// ********************** Routes Handling Add Song ******************************************

app.get("/admin/add-song", (req, res) => {
    // console.log(req.session.admin);
    if (req.session.admin) {
        console.log(req.session.admin);
        res.render("admin/addSong");
        // console.log("deleted...");
    }
})

app.post("/admin/add-song", upload.single('song'), async (req, res) => {
    const { album, artist, category } = req.body;
    const songFile = req.file;

    if (!songFile) {
        return res.status(400).json({ error: 'No song file uploaded' });
    }

    const filePath = path.join('uploads', songFile.filename); // Use the filename generated by multer
    const songTitle = songFile.originalname;

    try {
        // Insert song metadata into the database
        await db.query(
            'INSERT INTO songs (song_title, artist, category, file_path) VALUES ($1, $2, $3, $4)',
            [songTitle, artist, category, filePath]
        );

        // res.status(201).json({ message: 'Song added successfully' });
        // below is success message for the admin dashboard
        req.session.successMessage = 'Song added successfully!';

        // res.redirect('dashboard',);
        res.send(`
                <html>
                    <body>
                        <script>
                            alert("Song Added Successfully....");
                            window.location.href = "/admin/dashboard"; // Redirect to the home page
                        </script>
                    </body>
                </html>` )
    } catch (err) {
        console.error('Error adding song:', err);
        res.status(500).json({ error: 'Error adding song' });
    }
});
// *****************************************************************************

// ********************* Delete Song Route *************************************

// route for handling admin delete song functionality

app.get("/admin/delete-song", async (req, res) => {
    if (req.session.admin) {
        const result = await db.query("SELECT * FROM songs");
        const allSongs = result.rows;
        res.render('admin/deleteSong.ejs', { allSongs });
    }
})

app.get("/delete/:id", async (req, res) => {
    let songToDel = parseInt(req.params.id);

    console.log(songToDel);
    try {
        if (req.session.admin) {
            const sql = "DELETE FROM songs WHERE id = $1;";
            const values = [songToDel];
            await db.query(sql, values);
            res.redirect('/admin/dashboard');

        }
        else {
            res.redirect('admin/adminForm');
        }
        // res.json(songToDel, "delete successs")
    } catch (error) {
        console.log(error);
    }

})

// **********************************************************************

// ************************* Editing Song Details *********************************************

app.get("/admin/edit-song", async (req, res) => {
    if (req.session.admin) {
        const result = await db.query("SELECT * FROM songs");
        const allSongs = result.rows;
        res.render("admin/editSong.ejs", { allSongs });

    }
})
app.get("/edit/:id", async (req, res) => {
    let songIdToUpdate = parseInt(req.params.id);
    let songTitle, songArtist, songAlbum, songcategory, songFilePath;
    let song = "SELECT * FROM songs WHERE ID = $1";
    let values = [songIdToUpdate];
    let result = await db.query(song, values);
    console.log(result.rows[0]);


    songTitle = result.rows[0].song_title;
    songAlbum = result.rows[0].album;
    songArtist = result.rows[0].artist;
    songcategory = result.rows[0].category;
    // filePath = result.rows.file_path;

    res.render("admin/updateForm.ejs", { songIdToUpdate, songTitle, songAlbum, songArtist, songcategory });

})
app.post("/admin/update-song/:id", upload.single('song'), async (req, res) => {
    console.log(req.params.id);
    let songIdToUpdate = parseInt(req.params.id);
    let { songTitle, songArtist, songAlbum, songcategory } = req.body;

    // Get the file if it exists
    const songFile = req.file;
    let songFilePath = songFile ? path.join('uploads', songFile.filename) : null;

    // SQL query to update the song
    let updateSongQuery = `UPDATE songs 
            SET 
                song_title = $1, 
                artist = $2, 
                album = $3, 
                category = $4, 
                file_path = COALESCE($5, file_path) 
            WHERE 
                id = $6`;

    try {
        const getSongQuery = "SELECT * FROM songs WHERE id=$1";
        // Get the existing song record
        let result = await db.query(getSongQuery, [songIdToUpdate]);
        if (result.rows.length === 0) {
            return res.status(404).send("Song not found");
        }

        // Update the song record, keeping the original file path if no new file was uploaded
        await db.query(updateSongQuery, [songTitle, songArtist, songAlbum, songcategory, songFilePath, songIdToUpdate]);

        res.status(200).send("Song updated successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred while updating the song");
    }
});
// *******************************************************************************


// ################### Album Related Routes #################################


app.get("/admin/add-album", (req, res) => {
    if (req.session.admin) {
        res.render("admin/addAlbum.ejs");
    }
})

// post request handler
app.post("/admin/add-album", async (req, res) => {

    if (req.session.admin) {
        const title = req.body.title;
        const artist = req.body.artist;
        const releaseDate = req.body.releaseDate;
        const category = req.body.category;

        console.log(title, artist, releaseDate, category);

        try {
            // Insert album into the database
            await db.query(
                'INSERT INTO albums (title, artist, release_date, category) VALUES ($1, $2, $3, $4)',
                [title, artist, releaseDate, category]
            );

            req.session.success = 'Album added successfully!';
            res.redirect("/admin/dashboard");
        } catch (error) {
            console.error('Error inserting album:', error);
            req.session.error = 'There was an error adding the album.';
            res.redirect("/admin/dashboard");
        }
    }

})

// route for handle /admin/delete-album

app.get("/admin/delete-album", async(req,res)=>{

    let result = await db.query("SELECT * FROM albums");
    let allAlbums = result.rows;

    res.render('admin/deleteAlbum.ejs', {allAlbums});
    console.log(allAlbums);
})
// /admin/deleteAlbum
app.get("/admin/deleteAlbum/:id", async (req, res) => {
    let deleteID = req.params.id; // Access the ID parameter from the URL
    console.log(deleteID);

    if (req.session.admin) {
        try {
            let sql = "DELETE FROM albums WHERE album_id = $1";
            let values = [deleteID];
            let query = await db.query(sql, values);
            console.log(query.rows);
            res.send(`
                <html>
                    <body>
                        <script>
                            alert("Album Deleted Successfully....");
                            window.location.href = "/admin/dashboard"; // Redirect to the home page
                        </script>
                    </body>
                </html>`);
        } catch (error) {
            console.log(error);
        }
    }
});



// handling -  /admin/edit-album

app.get("/admin/edit-album",async (req,res)=>{
    let result = await db.query("SELECT * FROM albums");
    let allAlbums = result.rows;

    res.render("admin/editAlbum.ejs", {allAlbums});

})

app.get("/admin/edit-album/:id", async(req,res)=>{
    let editID = req.params.id;
    let result = db.query("SELECT * FROM albums WHERE album_id=$1", [editID]);
    let album = (await result).rows[0];
    // console.log(album.title);
    res.render("admin/albumEditForm.ejs", {album});
})


// /admin/submit-edit-album/5

app.post("/admin/submit-edit-album/:id", async(req,res)=>{
    let id = req.params.album_id;
    let title = req.body.title;
    let artist = req.body.artist;
    let releaseDate = req.body.releaseDate;
    console.log(releaseDate);
    let category = req.body.category;
    // console.log(id, title, artist,releaseDate, category);
    try {
        await db.query(
            `UPDATE albums 
            SET title = $1, artist = $2, release_date = $3, category = $4
            WHERE album_id = $5`,
            [title, artist, releaseDate, category, id]
        );
        req.session.success = 'Album updated successfully!';
        res.send(` <html>
                    <body>
                        <script>
                            alert("Album Updated Successfully....");
                            window.location.href = "/admin/dashboard"; // Redirect to the home page
                        </script>
                    </body>
                </html>`); // Redirect to the edit album page or any other appropriate page
    } catch (error) {
        console.error('Error updating album:', error);
        req.session.error = 'There was an error updating the album.';
        res.send('"/admin/edit-album"'); // Redirect back to the edit album page
    }
})


// add song to album - 
app.get('/admin/album/:albumId/add-song', async (req, res) => {
    const { albumId } = req.params;
    const album = await db.query("SELECT * FROM albums WHERE album_id = $1",[albumId]);
    const album_name = album.rows[0].title;
    const result = await db.query('SELECT * FROM songs WHERE album_id IS NULL '); // Songs not in any album

    const songs = result.rows;

    res.render('admin/addSongToAlbum', { albumId, songs, album_name });
});


app.post('/admin/album/:albumId/add-songs', async (req, res) => {
    const { albumId } = req.params;
    let songIds = req.body['songIds[]'];
    // console.log(req.body['songIds[]']);
    // console.log(songIds);
   
    try {
        // Add each selected song to the album
        for (const songId of songIds) {
            await db.query('INSERT INTO album_songs (album_id, song_id) VALUES ($1, $2) ON CONFLICT (album_id, song_id) DO NOTHING', [albumId, songId]);
        }
        
        // Redirect to the album edit page
        // res.redirect('/admin/edit-album/' + albumId);
        res.send(`
                <html>
                    <body>
                        <script>
                            alert("Songs Added To Album Successfully....");
                            window.location.href = "/admin/dashboard"; // Redirect to the home page
                        </script>
                    </body>
                </html>`);
    } catch (error) {
        console.error('Error adding songs to album:', error);
        res.status(500).send('Internal Server Error');
    }

  
});

// ####################################################################################

//   GET /admin/view-album



// ----------------- about-us routes ----------------------------
app.get('/about-us', (req, res) => {
    res.render("aboutUs.ejs");
})
// 
// ---------------------------------------------------------------


// #################### contact_us ###################################
app.get('/contact-us', (req, res) => {
    res.render("contactUs.ejs");
})
app.post('/submit-contact', async (req, res) => {

    try {
        let name = req.body.name;
        let email = req.body.email;
        let subject = req.body.subject;
        let message = req.body.message;
        console.log(name, email, subject, message);
        let sql = " INSERT INTO contact_us (name, email, subject, message) VALUES ($1, $2, $3, $4)";
        let values = [name, email, subject, message];
        await db.query(sql, values);
        // res.render("contactUs.ejs");
        res.send(`  <html>
        <body>
            <script>
                alert("Send Successfully....");
                window.location.href = "/"; // Redirect to the home page
            </script>
        </body>
    </html>`);

    } catch (error) {
        console.log(error);
    }

})

// --------------------------------------------------------------

// ############################ Promotions #############################################

app.get("/promotion", (req, res) => {
    res.render("promotions/promotionForm.ejs");

})

// ####################################################################################

app.listen(PORT, () => {

    console.log(`Server Started At: http://localhost:${PORT}/`);
    // console.log(`Server Started At:${PORT}/`);
})