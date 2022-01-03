const dummy_room_with_guests = {
  room_id: "dummy-id-with-guests",
  playlist_id: "123456789",
  users: {
    host: "host0",
    guests: ["guest1", "guest2", "guest3"]
  },
  empty: false
};

const dummy_room_no_guests = {
  room_id: "dummy-id-no-guests",
  playlist_id: "abcdefghi",
  users: {
    host: "host",
    guests: []
  },
  empty: false
};

const empty_room = {
  room_id: undefined,
  playlist_id: undefined,
  users: {
    host: undefined,
    guests: []
  },
  empty: true
};

var qs = require("qs");
var mongodb = require("mongodb");
var { v4: uuid } = require("uuid");

// set up express
var express = require("express");
var app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (request, response) => {
  response.sendFile(__dirname + "/src/pages/landing.html");
});

// Spotify node wrapper
var spotify = require("spotify-web-api-node");
var redirect_uri = `https://${process.env.PROJECT_DOMAIN}.glitch.me/callback`;
var scopes = [
  "user-read-private",
  "user-read-email",
  "user-top-read",
  "playlist-modify-private",
  "playlist-read-collaborative",
  "playlist-read-private",
  "playlist-modify-public"
];
var show_dialog = true;

var spotify_api = new spotify({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: redirect_uri
});

app.get("/authorize", (request, response) => {
  var { room_id } = request.params;
  var authorize_url = spotify_api.createAuthorizeURL(scopes, null, show_dialog);
  console.log("authorize url: " + authorize_url);
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
      response.redirect("/recents");
    },
    error => {
      console.log(error.message);
    }
  );
});

app.get("/recents", (request, response) => {
  var data = spotify_api
    .getMyRecentlyPlayedTracks({
      limit: 50
    })
    .then(
      data => {
        var track_names = data.body.items.map(el => el.track.name);
        console.log(track_names);

        response.render("recents", {
          track_names: track_names
        });
      },
      error => {
        console.log(error.message);
      }
    );
});

app.get("/:room_id", (request, response) => {
  var { room_id } = request.params;
});

///////////////////////////////////////

var listener = app.listen(process.env.PORT, () => {
  console.log("Listening on port " + listener.address().port);
});
