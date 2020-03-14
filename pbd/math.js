function Vector3(x, y, z)
{
  this.x = 0;
  this.y = 0;
  this.z = 0;
  
  if (x instanceof Vector3 && y == undefined && z == undefined)
  {
    var other = x;
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
  }
  else if (typeof(x) == "number" && typeof(y) == "number" && typeof(z) == "number")
  {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  
  this.Copy = function()
  {
    return new Vector3(this);
  }

  this.Magnitude = function()
  {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
 
}

Vector3.Zero = function()
{
  return new Vector3();
}

function Matrix3(other)
{
  // 3x3 array (indexed as [row][col])
  this.m = new Array(3);
  
  if (other == undefined)
  {
    // No arguments -> identity matrix
    this.m[0] = [ 1.0, 0.0, 0.0 ];
    this.m[1] = [ 0.0, 1.0, 0.0 ];
    this.m[2] = [ 0.0, 0.0, 1.0 ];
  }
  else
  {
    this.m[0] = [ other.m[0][0], other.m[0][1], other.m[0][2] ];
    this.m[1] = [ other.m[1][0], other.m[1][1], other.m[1][2] ];
    this.m[2] = [ other.m[2][0], other.m[2][1], other.m[2][2] ];
  }
  
  this.Transpose = function()
  {
    var t = new Matrix3();
    t.m[0] = [ this.m[0][0], this.m[1][0], this.m[2][0] ];
    t.m[1] = [ this.m[0][1], this.m[1][1], this.m[2][1] ];
    t.m[2] = [ this.m[0][2], this.m[1][2], this.m[2][2] ];
    return t;
  }
  
  this.T = function()
  {
    return this.Transpose();
  }
}

Matrix3.Identity = function()
{
  return new Matrix3();
}

Matrix3.Zero = function()
{
  var z = new Matrix3();
  z.m[0][0] = 0.0;
  z.m[1][1] = 0.0;
  z.m[2][2] = 0.0;
  return z;
}

function Add(a, b)
{
  if ((a instanceof Vector3) && (b instanceof Vector3))
  {
    return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
  }
  return undefined;
}

function Sub(a, b)
{
  if ((a instanceof Vector3) && (b instanceof Vector3))
  {
    return new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
  }
  return undefined;
}

function Mult(a, b)
{
  if ((a instanceof Matrix3) && (b instanceof Matrix3))
  {
    var rows = a.m.length;
    var cols = b.m[0].length;
    var product = new Matrix3();
    for (var y = 0; y < rows; y++)
    {
      for (var x = 0; x < cols; x++)
      {
        var n = 0.;
        for (var i = 0; i < b.m.length; i++)
          n += a.m[y][i] * b.m[i][x];
        product.m[y][x] = n;
      }
    }
    return product;
  }
  else if ((a instanceof Matrix3) && (typeof(b) == "number"))
  {
    var product = new Matrix3(a);
    for (var y = 0; y < 3; y++)
    {
      for (var x = 0; x < 3; x++)
      {
        product.m[y][x] *= b;
      }
    }
    return product;
  }
  else if ((a instanceof Matrix3) && (b instanceof Vector3))
  {
      var product = new Vector3();
      product.x = a.m[0][0] * b.x + a.m[0][1] * b.y + a.m[0][2] * b.z;
      product.y = a.m[1][0] * b.y + a.m[1][1] * b.y + a.m[1][2] * b.z;
      product.z = a.m[2][0] * b.x + a.m[2][1] * b.y + a.m[2][2] * b.z;
      return product;
  }
  else if ((typeof(a) == "number") && (b instanceof Vector3))
  {
      return new Vector3(a * b.x, a * b.y, a * b.z);
  }
  else if ((a instanceof Vector3) && (typeof(b) == "number"))
  {
      return new Vector3(b * a.x, b * a.y, b * a.z);
  }
  
  return undefined;
}

function Dot(u, v)
{
  return u.x * v.x + u.y * v.y + u.z * v.z;
}

function Cross(u, v)
{
  var x = u.y * v.z - u.z * v.y;
  var y = -(u.x * v.z - u.z * v.x);
  var z = u.x * v.y - u.y * v.x;
  return new Vector3(x, y, z);
}