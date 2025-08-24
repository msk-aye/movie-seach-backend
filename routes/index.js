var express = require('express');
var router = express.Router();
const authorization = require('../middleware/authorization');

// router.get('/movies/search')  -- needs cleaning + error handling
router.get('/movies/search', function (req, res, next) {
  let title = req.query.title || null;
  let year = req.query.year || null;
  let page = req.query.page || 1;

  if (year && year.length !== 4) {
    console.log('err');
    res.status(400).json({ error: true, 
      message: "Invalid year format. Format must be yyyy." });
  } else if (isNaN(page)) {
    console.log('err');
    res.status(400).json({ error: true, 
      message: "Invalid page format. page must be a number." });
  } else {
    year = parseInt(year);
    page = parseInt(page);

    req.db
      .from("basics")
      .select("primaryTitle as title",
        "year",
        "tconst as imdbID",
        "imdbRating",
        "rottentomatoesRating as rottenTomatoesRating",
        "metacriticRating",
        "rated as classification")
      .modify((query) => {
        if (title) {
          query.where("primaryTitle", "like", `%${title}%`);
        }
        if (year) {
          query.andWhere("year", year);
        }
      })
      .then((rows) => {
        rows = rows.map((row) => {
          return {  // not graceful
            title: row.title,
            year: row.year,
            imdbID: row.imdbID,
            imdbRating: parseFloat(row.imdbRating),
            rottenTomatoesRating: parseInt(row.rottenTomatoesRating),
            metacriticRating: parseInt(row.metacriticRating),
            classification: row.classification
          };
        });
        total = rows.length
        limited = rows.slice((page - 1) * 100, page * 100)
        from = (page - 1) * 100
        lastMovie = (page * 100) < total ? page * 100 : total
        lastPage = Math.ceil(total / 100)
        to = (page > lastPage) && (lastPage !== 0) ? (page-1) * 100 : lastMovie

        prevPage = (page - 1) > 0 ? page - 1 : null
        nextPage = (page + 1) > lastPage ? null : page + 1

        res.json({ data: limited, 
          pagination: {
            total: total,
            lastPage: lastPage,
            perPage: 100,
            currentPage: page,
            prevPage: prevPage,
            nextPage: nextPage,
            from: from,
            to: to } });
      })
      .catch((err) => {
        console.log(err);
        res.json({ Error: true, Message: "Error in MySQL query" });
      });
  }
});

// router.get('/movies/data/:id')   -- needs cleaning + error handling
router.get('/movies/data/:id', function (req, res, next) {
  let id = req.params.id || null;

  if (Object.keys(req.query).length > 0) {
    queries = Object.keys(req.query).join(", ");
    res.status(400).json({ error: true,
      message: `Invalid query parameters: ${queries}. Query parameters are not permitted.`})
    return;
  }

  req.db
    .from("principals")
    .select("nconst as id",
      "category",
      "name",
      "characters"
    )
    .where("tconst", id)
    .then((principals) => {
      principals = principals.map((row) => {
        return {
          id: row.id,
          category: row.category,
          name: row.name,
          characters: row.characters.split(",").map((character) => {
            character = character.replace(/\[|\]|"/g, "");
            return character;
          }).filter((character) => character !== "")
        };
      });
      req.db
        .from("basics")
        .select("primaryTitle as title",
          "year",
          "runtimeMinutes as runtime",
          "genres",
          "country",
          "boxoffice",
          "poster",
          "plot",
          "imdbRating",
          "rottentomatoesRating as rottenTomatoesRating",
          "metacriticRating")
        .where("tconst", id)
        .then((row) => {
          if (row.length === 0) {
            res.status(404).json({ error: true,
              message: "No record exists of a movie with this ID" });
            return;
          }
          ratings = [
            {
              source: "Internet Movie Database",
              value: parseFloat(row[0].imdbRating)
            },
            {
              source: "Rotten Tomatoes",
              value: parseInt(row[0].rottenTomatoesRating)
            },
            {
              source: "Metacritic",
              value: parseInt(row[0].metacriticRating)
            }
          ]
            res.json( {  // not graceful
              title: row[0].title,
              year: row[0].year,
              runtime: row[0].runtime,
              genres: row[0].genres.split(","),
              country: row[0].country,
              principals: principals,
              ratings: ratings,
              boxoffice: row[0].boxoffice,
              poster: row[0].poster,
              plot: row[0].plot,
            });
      })
    })
    .catch((err) => {
      console.log(err);
      res.json({ Error: true, Message: "Error in MySQL query" });
    });
})

// router.get ('/people/:id')  -- needs cleaning + error handling
router.get('/people/:id', authorization, (req, res) => {

  let id = req.params.id || null;

  if (Object.keys(req.query).length > 0) {
    queries = Object.keys(req.query).join(", ");
    res.status(400).json({ error: true,
      message: `Invalid query parameters: ${queries}. Query parameters are not permitted.` })
    return;
  }

  req.db
    .from("principals")
    .join("basics", "principals.tconst", "=", "basics.tconst")
    .select(
      "principals.tconst as tconst",
      "principals.category as category",
      "principals.characters as characters",
      "basics.primaryTitle as movieTitle",
      "basics.imdbRating as movieRating"
    )
    .where("principals.nconst", id)

    .then((roles) => {
      roles = roles.map((row) => {
        return {
          tconst: row.tconst,
          category: row.category,
          characters: row.characters.split(",").map((character) => {
            character = character.replace(/\[|\]|"/g, "");
            return character;
          }).filter((character) => character !== ""),
          movieTitle: row.movieTitle,
          movieRating: parseFloat(row.movieRating)
        };
      });
      req.db
        .from("names")
        .select("primaryName as name",
          "birthYear",
          "deathYear")
        .where("nconst", id)
        .then((info) => {
          if (info.length === 0) {
            res.status(404).json({ error: true,
              message: "No record exists of a person with this ID" });
            return;
          }
          res.json({
            name: info[0].name,
            birthYear: info[0].birthYear,
            deathYear: info[0].deathYear,
            roles: roles.map((role) => {
              return {
                movieName: role.movieTitle,
                movieId: role.tconst,
                category: role.category,
                characters: role.characters,
                imdbRating: role.movieRating
              };
            }),
          })
        })
    })
    .catch((err) => {
      console.log(err);
      res.json({ Error: true, Message: "Error in MySQL query" });
    });
})

module.exports = router;
