# FetchQ Client // Examples // Workflow API

This example runs a bunch of Fetchq clients that could be easily
distributed as independent services on different machines.

Each client solves a microscopic piece of the puzzle, they all
work together, orchestrating themselves through Postgres, to
execute a difficult task: **double only even numbers**.

Yeah, you heard it. Just duplicate even numbers.  
How difficult could it be?

Turns out there are a few responsibilities here:

1. Play the game with random numbers
2. Implement the game logic

   - validate that the input is an even number
   - do the math
   - prepare a nice result message

3. Create the necessary data structure

## Note on push performances:

This example depends (almost) entirely on the push mechanism as we disabled the maintenance in every client, and the workers will sleep
for about one hour in between executions.

Only the push signal from Postgres is able to awake the consumers and
trigger the execution of the job. And it works pretty much real time 🤟.
