/*
 * edit.js
 *
 * EditOperation interface and concrete implementations. These handle editing
 * operations in the canvas window. A single given operation is active at any
 * given time.
 */


/*
 * EditOperation:
 *
 * All edit operations must implement this interface.
 */

function EditOperation()
{
}

EditOperation.prototype.Draw = function(ctx) {}
EditOperation.prototype.OnMouseMove = function(x, y) {}
EditOperation.prototype.OnMouseDown = function(x, y) {}
EditOperation.prototype.Cancel = function() {}


/*
 * CreateVertexOperation:
 *
 * Places vertices into a physics body.
 */

function CreateVertexOperation(body, fillColor)
{
  this.body = body;
  this.vertexMass = 1;
  this.fillColor = fillColor;
}

CreateVertexOperation.prototype = new EditOperation();

CreateVertexOperation.prototype.OnMouseDown = function(x, y)
{
  if (!this.body)
  {
    return;
  }

  var vertex = new Vertex(x, y, this.vertexMass);
  vertex.AddForce(0, -g_gravity * vertex.mass);
  vertex.fillColor = this.fillColor;
  this.body.AddVertex(vertex);
}


/*
 * CreateConstraintOperation:
 *
 * Adds distance constraints between any two vertices (which may exist on
 * different bodies) to the physics system.
 */

function CreateConstraintOperation(physics)
{
  this.physics = physics;
  this.k = 1;
  this.cursor = Vector3.Zero();
  this.highlightedVertex = null;
  this.vertex1 = null;
  this.vertex2 = null;

  this.FinalizeConstraint = function()
  {
    if (this.vertex1 == null || this.vertex2 == null)
    {
      return;
    }

    var constraint = new DistanceConstraint(this.k, this.vertex1, this.vertex2, Vector3.Distance(this.vertex1.Position(), this.vertex2.Position()));
    this.physics.AddConstraint(constraint);
    this.vertex1 = null;
    this.vertex2 = null;
  }
}

CreateConstraintOperation.prototype = new EditOperation();

CreateConstraintOperation.prototype.Draw = function(ctx)
{
  // Draw constraint in progress
  if (this.vertex1)
  {
    var from = this.vertex1.Position().Copy();
    var to = !this.vertex2 ? this.cursor.Copy() : this.vertex2.Position();
    from.y = ctx.canvas.height - from.y;
    to.y = ctx.canvas.height - to.y;
    var delta = Sub(to, from);
    var mag = delta.Magnitude();
    var dir = Mult(delta, 1.0 / mag);
    ctx.beginPath();
    ctx.moveTo(from.x + dir.x * 4, from.y + dir.y * 4);
    ctx.lineTo(to.x - dir.x * 4, to.y - dir.y * 4);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000";
    ctx.stroke();
  }

  // Draw highlighted vertex
  if (this.highlightedVertex)
  {
    var pos = this.highlightedVertex.Position();
    ctx.beginPath();
    ctx.arc(pos.x, ctx.canvas.height - pos.y, 4, 0, 360);
    ctx.fillStyle = "#88f";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000";
    ctx.stroke();
  }
}

CreateConstraintOperation.prototype.OnMouseMove = function(x, y)
{
  this.cursor = new Vector3(x, y, 0);
  this.highlightedVertex = this.physics.FindVertexAt(x, y);
}

CreateConstraintOperation.prototype.OnMouseDown = function(x, y)
{
  this.cursor = new Vector3(x, y, 0);

  var vertex = this.highlightedVertex;
  if (vertex)
  {
    // Clicked on a vertex
    if (!this.vertex1)
    {
      // First vertex clicked on
      this.vertex1 = vertex;
      this.vertex2 = null;
    }
    else if (vertex == this.vertex1)
    {
      // Clicked on same vertex as the first one. Cancel operation.
      this.Cancel();
    }
    else
    {
      // Clicked on a second vertex. Finalize constraint.
      this.vertex2 = vertex;
      this.FinalizeConstraint();
    }
  }
  else
  {
    // Clicked on nothing or same endpoint. Cancel.
    this.Cancel();
  }
}

CreateConstraintOperation.prototype.Cancel = function()
{
  this.vertex1 = null;
  this.vertex2 = null;
}