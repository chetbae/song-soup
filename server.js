var qs = require('qs');

// set up express
var express = require("express");
var app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (request, response) => {
  response.sendFile(__dirname + "/views/landing.html");
});

// Spotify node wrapper
var spotify = require("spotify-web-api-node");
var redirect_uri = `https://${process.env.PROJECT_DOMAIN}.glitch.me/callback`;
var scopes = [
  "user-read-private",
  "user-read-email",
  "user-top-read",
  "user-read-recently-played"
];
var show_dialog = false;

var spotify_api = new spotify({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: redirect_uri
});

app.get("/authorize", (request, response) => {
  var authorize_url = spotify_api.createAuthorizeURL(scopes, null, show_dialog);
  response.redirect(authorize_url);
});

app.get("/callback", (request, response) => {
  var authorization_code = request.query.code;

  spotify_api.authorizationCodeGrant(authorization_code).then(
    data => {
      console.log("The token expires in " + data.body["expires_in"]);
      console.log(
        "The access token is " +
          data.body["access_token"].substring(0, 10) +
          "..."
      );
      console.log(
        "The refresh token is " +
          data.body["refresh_token"].substring(0, 10) +
          "..."
      );

      spotify_api.setAccessToken(data.body["access_token"]);
      spotify_api.setRefreshToken(data.body["refresh_token"]);
      response.redirect("/rundown");
    },
    error => {
      console.log(error.message);
    }
  );
});

app.get("/rundown", async (request, response) => {
  console.log("fetching data...");
  // response.render("waiting");
  var data = await get_data('short_term'); // short term for most recent listening expriences
  data.genres = get_genres_from_artists(data.top_artists);
  
  var display = {
    profile: print_profile(data.profile),
    artists: print_artists(data.top_artists),
    tracks: print_tracks(data.top_tracks),
    genres: print_genres(data.genres),
    recents: print_tracks(data.recents)
  }
    
  response.render('rundown', display);
});

// returns top artists, top tracks, and profile information
async function get_data(term) {
  var profile = spotify_api.getMe().then(res => {return res.body;}, (err) => console.log(err.message));
  
  var top_artists = spotify_api.getMyTopArtists({
    limit: 50, offset: 0, time_range: term
  }).then(res => {return res.body.items;}, (err) => console.log(err.message));
  
  var top_tracks = spotify_api.getMyTopTracks({
    limit: 50, offset: 0, time_range: term
  }).then(res => {return res.body.items;}, (err) => console.log(err.message));
  
  var recents = spotify_api.getMyRecentlyPlayedTracks({limit: 50}).then(res => {return res.body.items.map(e => e.track);}, (err) => console.log(err.message));
  
  
  return {
    profile: await profile,
    top_artists: await top_artists,
    top_tracks: await top_tracks,
    recents: await recents
  }
}

// takes in raw artists data, returns sorted genres [...{genre:'name', instances:0}]
function get_genres_from_artists(artists) {
  // count instances of genres
  var db = {};
  try {
    artists.forEach((artist) => {
    var genres = artist.genres;
    
    genres.forEach((key) => {
      db[key] = (db[key] || 0) + 1;
    });
  });
  } catch (err) { console.log(err) }
  // turn into array and sort numerically descending, alphabetically ascending
  var result = Object.keys(db)
  .map((key) => Object({
    genre: String(key), 
    instances: db[key]
  }));
  
  // comparator
  var c = (a, b) => {
    if(a.instances > b.instances) return -1;
    else if(a.instances < b.instances) return 1;
    else if(a.genre.toUpperCase() < b.genre.toUpperCase()) return -1;
    else return 1;
  }
  
  return result.sort(c);
}

function print_profile(profile) {
  try {
    const name = `<h1 class='profile_name'>${profile.display_name}</h1>`;
    const image = `<img class='profile_picture' src='${profile.images[0].url}'/>`;
    // const email = `<p class='profile email'>${profile.email}</p>`;

    return `<a class="profile_container" href='${profile.external_urls.spotify}' target='_blank'>${image}${name}</a>`
  } catch (err) {console.log(err)}
}

function print_artists(artists) {
  var out = '';
  
  // const name = (e) => '<p class=\'artist name\'>' + e + '</p>';
  const image = (e) => '<img class=\'artists_picture\' src=\'' + e + '\'/>';
  const link = (link, e) => '<a href=\'' + link + '\' target=\'_blank\'>' + e + '</a>';
  
  const row = (im, i, name, l) => 
    link(l, '<div class=\'artists_row\'>' + 
      image(im) + 
      '<h2 class=\'artists_name\'>' + i + '. &nbsp;' + name + '</h2>' + 
    '</div>');
  
  var i = 1;
  
  try {
    artists.forEach(e => {
      out += row(e.images[0].url, i, e.name, e.external_urls.spotify);
      i++;
    })
  } catch (e) { console.log(e); }
  
  return out;
}

function print_tracks(tracks) {
  var out = '';
  
  const name = (e) => '<p class=\'tracks_name\'>' + e + '</p>';
  const image = (e) => '<img class=\'tracks_picture\' src=\'' + e + '\'/>';
  const link = (link, e) => '<a href=\'' + link + '\' target=\'_blank\'>' + e + '</a>';
  const artists = (list) => {
    var res = '';
    try {
      var n = list.length;
      for (var i = 0; i < n; i++) {
        res += list[i].name;
        if (i !== n-1) res += ', ';
      }
    } catch (err) { console.log(err); }
    return `<p class="tracks_artists">${res}</p>`;
  };
  
  const row = (im, i, nm, a_list, l) => 
    '<tr>' +
      '<td>' + link(l, image(im)) + '</td>' +
      '<td>' + link(l, name(`${i}. ${nm}`)) + '</td>' +
      '<td>' + artists(a_list) + '</td>' + 
    '<tr>';
  
  var i = 1;
  
  try {
    tracks.forEach(e => {
      out += row(e.album.images[0].url, i, e.name, e.artists, e.external_urls.spotify);
      i++;
    })
  } catch (err) { console.log(err); }
  
  return '<table class=\'tracks_table\'>' + out + '</table>';
}

function print_genres(genres) {
  var out = '';
  
  var sup = i => i === 1 ? 'st' : (i === 2 ? 'nd' : (i === 3 ? 'rd' : 'th'));
  var i = 1;
  try {
    genres.slice(0,10).forEach(e => {
      out += `<tr><td><h1 class='genres_i'>${i}<sup class='genres_super'>${sup(i)}</sup></h1></td><td><h1 class='genres_name'>${e.genre}</h1></td></tr>`;
      i++;
  })
  } catch (err) { console.log(err) }
  
  return `<table class='genres_table'>${out}</table>`;
}

///////////////////////////////////////

var listener = app.listen(process.env.PORT, () => {
  console.log("Listening on port " + listener.address().port);
});
